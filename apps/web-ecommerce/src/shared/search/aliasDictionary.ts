import rawAliasData from './data/product-aliases.json';
import {
  compactText,
  normalizeSearchText,
  partitionQueryTokens,
  tokenize,
} from './textNormalizer';

export interface AliasEntity {
  id: string;
  canonicalName: string;
  vietnameseName: string;
  modelCodes: string[];
  aliases: string[];
}

export interface BrandAlias {
  canonical: string;
  aliases: string[];
}

export interface QueryResolution {
  rawQuery: string;
  normalizedQuery: string;
  compactQuery: string;
  coreTokens: string[];
  descriptorTokens: string[];
  matchedEntities: AliasEntity[];
  matchedBrands: string[];
  targetModelCodes: string[];
  expandedKeywords: string[];
  isVerifiedAliasMatch: boolean;
}

interface AliasDataSchema {
  entities: AliasEntity[];
  brands: BrandAlias[];
  productSpecificAliases?: Record<string, string[]>;
}

class AliasDictionaryService {
  private entities: AliasEntity[] = [];
  private brands: BrandAlias[] = [];
  private productSpecificAliases: Map<string, Set<string>> = new Map();

  // Fast in-memory lookup indices
  private compactToEntity: Map<string, AliasEntity> = new Map();
  private modelCodeToEntity: Map<string, AliasEntity> = new Map();
  private compactToBrand: Map<string, string> = new Map();

  constructor() {
    this.load(rawAliasData as unknown as AliasDataSchema);
  }

  public load(data: AliasDataSchema): void {
    this.entities = data.entities || [];
    this.brands = data.brands || [];
    this.compactToEntity.clear();
    this.modelCodeToEntity.clear();
    this.compactToBrand.clear();
    this.productSpecificAliases.clear();

    for (const entity of this.entities) {
      this.indexEntity(entity);
    }

    for (const brand of this.brands) {
      this.indexBrand(brand);
    }

    if (data.productSpecificAliases) {
      for (const [key, aliases] of Object.entries(data.productSpecificAliases)) {
        const compactKey = compactText(key);
        if (!this.productSpecificAliases.has(compactKey)) {
          this.productSpecificAliases.set(compactKey, new Set());
        }
        for (const a of aliases) {
          this.productSpecificAliases.get(compactKey)!.add(a);
        }
      }
    }
  }

  private indexEntity(entity: AliasEntity): void {
    // Index canonical name
    this.compactToEntity.set(compactText(entity.canonicalName), entity);
    // Index Vietnamese name
    if (entity.vietnameseName) {
      this.compactToEntity.set(compactText(entity.vietnameseName), entity);
    }
    // Index all aliases
    for (const alias of entity.aliases) {
      const c = compactText(alias);
      if (c) {
        this.compactToEntity.set(c, entity);
      }
    }
    // Index model codes
    for (const code of entity.modelCodes) {
      const c = compactText(code);
      if (c) {
        this.modelCodeToEntity.set(c, entity);
      }
    }
  }

  private indexBrand(brand: BrandAlias): void {
    this.compactToBrand.set(compactText(brand.canonical), brand.canonical);
    for (const alias of brand.aliases) {
      const c = compactText(alias);
      if (c) {
        this.compactToBrand.set(c, brand.canonical);
      }
    }
  }

  /**
   * Adds an alias to an existing entity dynamically (e.g. at runtime or from admin data).
   */
  public registerAlias(entityId: string, alias: string): boolean {
    const entity = this.entities.find((e) => e.id === entityId);
    if (!entity) return false;
    if (!entity.aliases.includes(alias)) {
      entity.aliases.push(alias);
    }
    const c = compactText(alias);
    if (c) {
      this.compactToEntity.set(c, entity);
    }
    return true;
  }

  /**
   * Registers a product-specific alias.
   */
  public registerProductAlias(modelCodeOrSku: string, alias: string): void {
    const compactKey = compactText(modelCodeOrSku);
    if (!this.productSpecificAliases.has(compactKey)) {
      this.productSpecificAliases.set(compactKey, new Set());
    }
    this.productSpecificAliases.get(compactKey)!.add(alias);
  }

  /**
   * Resolves a user's search query against the alias dictionary and normalizes it.
   */
  public resolveQuery(rawQuery: string): QueryResolution {
    const trimmed = (rawQuery || '').trim();
    const normalized = normalizeSearchText(trimmed);
    const compact = compactText(trimmed);
    const allTokens = tokenize(trimmed);
    const { core: coreTokens, descriptors: descriptorTokens } = partitionQueryTokens(allTokens);

    const matchedEntitiesSet = new Set<AliasEntity>();
    const matchedBrandsSet = new Set<string>();
    const targetModelCodesSet = new Set<string>();
    const expandedKeywordsSet = new Set<string>();

    // 1. Direct match on compact full query (e.g. "aobing", "natra", "ngaobinh")
    if (compact) {
      const directEntity = this.compactToEntity.get(compact) || this.modelCodeToEntity.get(compact);
      if (directEntity) {
        matchedEntitiesSet.add(directEntity);
      }
      const directBrand = this.compactToBrand.get(compact);
      if (directBrand) {
        matchedBrandsSet.add(directBrand);
      }
    }

    // 2. Direct match on core tokens combined (e.g. "ao binh" -> "aobing", "na tra" -> "natra")
    const coreCompact = compactText(coreTokens.join(''));
    if (coreCompact && coreCompact !== compact) {
      const coreEntity = this.compactToEntity.get(coreCompact) || this.modelCodeToEntity.get(coreCompact);
      if (coreEntity) {
        matchedEntitiesSet.add(coreEntity);
      }
      const coreBrand = this.compactToBrand.get(coreCompact);
      if (coreBrand) {
        matchedBrandsSet.add(coreBrand);
      }
    }

    // 3. Sub-phrase / n-gram token matching (e.g. query "na tra mô hình" or "aobing figure")
    if (coreTokens.length > 0) {
      // Check each single core token
      for (const token of coreTokens) {
        const c = compactText(token);
        const entity = this.compactToEntity.get(c);
        if (entity) {
          matchedEntitiesSet.add(entity);
        }
        const brand = this.compactToBrand.get(c);
        if (brand) {
          matchedBrandsSet.add(brand);
        }
      }

      // Check pairs of core tokens (e.g. ["ao", "binh"] -> "aobing")
      for (let i = 0; i < coreTokens.length - 1; i++) {
        const pair = compactText(coreTokens[i] + coreTokens[i + 1]);
        const entity = this.compactToEntity.get(pair);
        if (entity) {
          matchedEntitiesSet.add(entity);
        }
      }
    }

    // 4. Collect model codes & expanded keywords from matched entities
    for (const entity of matchedEntitiesSet) {
      for (const code of entity.modelCodes) {
        targetModelCodesSet.add(code);
      }
      expandedKeywordsSet.add(entity.canonicalName);
      if (entity.vietnameseName) {
        expandedKeywordsSet.add(entity.vietnameseName);
      }
      for (const a of entity.aliases) {
        expandedKeywordsSet.add(a);
      }
    }

    // 5. Check product-specific custom aliases
    for (const [key, aliases] of this.productSpecificAliases.entries()) {
      if (compact === key || coreCompact === key) {
        for (const a of aliases) {
          expandedKeywordsSet.add(a);
        }
      }
      for (const alias of aliases) {
        if (compact === compactText(alias) || coreCompact === compactText(alias)) {
          for (const a of aliases) {
            expandedKeywordsSet.add(a);
          }
        }
      }
    }

    const matchedEntities = Array.from(matchedEntitiesSet);
    const matchedBrands = Array.from(matchedBrandsSet);
    const targetModelCodes = Array.from(targetModelCodesSet);
    const expandedKeywords = Array.from(expandedKeywordsSet);
    const isVerifiedAliasMatch = matchedEntities.length > 0 || matchedBrands.length > 0;

    return {
      rawQuery: trimmed,
      normalizedQuery: normalized,
      compactQuery: compact,
      coreTokens,
      descriptorTokens,
      matchedEntities,
      matchedBrands,
      targetModelCodes,
      expandedKeywords,
      isVerifiedAliasMatch,
    };
  }

  /**
   * Retrieves all registered entities (for inspection/testing).
   */
  public getAllEntities(): AliasEntity[] {
    return this.entities;
  }
}

export const AliasDictionary = new AliasDictionaryService();
export default AliasDictionary;
