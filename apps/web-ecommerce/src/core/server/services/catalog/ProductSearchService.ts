import { Op, type WhereOptions } from 'sequelize';
import AliasDictionary, { type AliasEntity, type QueryResolution } from '../../../../shared/search/aliasDictionary';
import {
  compactText,
  isDescriptorToken,
  normalizeSearchText,
  removeDiacritics,
  tokenize,
} from '../../../../shared/search/textNormalizer';
import ProductModel from '../../database/client/models/Product.Model';

export interface ScoredProduct<T = ProductModel> {
  product: T;
  score: number;
  matchReasons: string[];
}

export class ProductSearchService {
  /**
   * Resolves a query using the alias dictionary and normalized rules.
   */
  public static resolve(rawQuery: string): QueryResolution {
    return AliasDictionary.resolveQuery(rawQuery);
  }

  /**
   * Builds SQL where conditions that retrieve all possible candidate products matching
   * the user's query, considering canonical names, verified aliases, unaccented variations,
   * and model codes.
   */
  public static buildSearchConditions(rawQuery: string): WhereOptions {
    const trimmed = (rawQuery || '').trim();
    if (!trimmed) return {};

    const resolution = this.resolve(trimmed);
    const words = trimmed.split(/[^\p{L}\p{N}-]+/u).filter(Boolean).slice(0, 8);

    // If verified entity alias is matched (e.g. "aobing", "natra", "Ao Binh", "ngao bính")
    if (resolution.isVerifiedAliasMatch) {
      const aliasOrConditions: WhereOptions[] = [];

      // 1. Target model codes (e.g. MNP-XH03, MNQ-XH03 for aobing; MNP-XH04 for natra)
      if (resolution.targetModelCodes.length > 0) {
        aliasOrConditions.push({
          modelCode: { [Op.in]: resolution.targetModelCodes },
        });
      }

      // 2. Canonical and Vietnamese character names (e.g. "Ao Bing", "Ngao Bính", "Ne Zha", "Na Tra")
      for (const kw of resolution.expandedKeywords) {
        const pattern = `%${kw.replace(/[\\%_]/g, '\\$&')}%`;
        aliasOrConditions.push(
          { name: { [Op.iLike]: pattern } },
          { modelCode: { [Op.iLike]: pattern } },
        );
      }

      // 3. For any non-descriptor words, also require standard column match
      const nonDescriptorWords = words.filter((w) => !isDescriptorToken(w));
      if (nonDescriptorWords.length > 0) {
        const wordConditions: WhereOptions[] = [];
        for (const word of nonDescriptorWords) {
          const pattern = `%${word.replace(/[\\%_]/g, '\\$&')}%`;
          const unaccented = removeDiacritics(word);
          const unaccentPattern = `%${unaccented.replace(/[\\%_]/g, '\\$&')}%`;

          const colOr: WhereOptions[] = ['name', 'brandName', 'sku', 'modelCode'].map((col) => ({
            [col]: { [Op.iLike]: pattern },
          }));
          if (unaccented !== word) {
            colOr.push(
              ...['name', 'brandName', 'sku', 'modelCode'].map((col) => ({
                [col]: { [Op.iLike]: unaccentPattern },
              })),
            );
          }
          wordConditions.push({ [Op.or]: colOr });
        }
        aliasOrConditions.push({ [Op.and]: wordConditions });
      }

      return { [Op.or]: aliasOrConditions };
    }

    // Default: when no alias entity matches, follow standard word-by-word token matching
    // exactly matching the expectations of tests (like customer-assistant.test.ts)
    const conditions: WhereOptions[] = [];
    for (const word of words) {
      const pattern = `%${word.replace(/[\\%_]/g, '\\$&')}%`;
      const unaccented = removeDiacritics(word);
      const unaccentPattern = `%${unaccented.replace(/[\\%_]/g, '\\$&')}%`;

      const colOr: WhereOptions[] = ['name', 'brandName', 'sku', 'modelCode'].map((column) => ({
        [column]: { [Op.iLike]: pattern },
      }));

      // Also support accent-insensitivity (e.g. searching "doanh chinh" matches "Doanh Chính")
      if (unaccented !== word) {
        colOr.push(
          ...['name', 'brandName', 'sku', 'modelCode'].map((column) => ({
            [column]: { [Op.iLike]: unaccentPattern },
          })),
        );
      }

      conditions.push({ [Op.or]: colOr });
    }

    return { [Op.and]: conditions };
  }

  /**
   * Scores and ranks candidate products according to exact matches, verified aliases,
   * token coverage, descriptor alignment, and availability.
   * Filters out spurious false positives with insufficient confidence.
   */
  public static rankCandidates<T extends {
    id: number;
    name: string;
    brandName?: string | null;
    modelCode?: string | null;
    sku?: string | null;
    stock?: number | null;
    sold?: number | null;
    assemblyState?: string | null;
    salesChannel?: string | null;
  }>(products: T[], rawQuery: string): T[] {
    const trimmed = (rawQuery || '').trim();
    if (!trimmed || products.length === 0) return products;

    const resolution = this.resolve(trimmed);
    const scoredList: ScoredProduct<T>[] = [];

    const normQuery = resolution.normalizedQuery;
    const compactQuery = resolution.compactQuery;
    const coreCompact = compactText(resolution.coreTokens.join(''));

    for (const product of products) {
      const prodName = product.name || '';
      const prodNorm = normalizeSearchText(prodName);
      const prodCompact = compactText(prodName);
      const prodModelCode = product.modelCode || '';
      const prodModelCodeCompact = compactText(prodModelCode);
      const prodSku = product.sku || '';
      const prodSkuCompact = compactText(prodSku);
      const prodBrand = product.brandName || '';
      const prodBrandNorm = normalizeSearchText(prodBrand);
      const prodBrandCompact = compactText(prodBrand);

      let score = 0;
      const reasons: string[] = [];

      // --- Tier 1: Direct SKU or Model Code exact match (Highest Priority) ---
      if (compactQuery && (compactQuery === prodSkuCompact || compactQuery === prodModelCodeCompact)) {
        score += 1000;
        reasons.push('exact_code_match');
      } else if (coreCompact && (coreCompact === prodSkuCompact || coreCompact === prodModelCodeCompact)) {
        score += 950;
        reasons.push('core_code_match');
      } else if (prodModelCode && normQuery.includes(normalizeSearchText(prodModelCode))) {
        score += 850;
        reasons.push('model_code_in_query');
      }

      // --- Tier 2: Verified Alias & Character Entity Match ---
      if (resolution.isVerifiedAliasMatch) {
        // Model code mapped to verified alias entity (e.g. MNP-XH03 for "aobing")
        if (prodModelCode && resolution.targetModelCodes.includes(prodModelCode)) {
          score += 800;
          reasons.push('verified_alias_model_code');
        }

        // Product name contains entity canonical or Vietnamese name
        for (const entity of resolution.matchedEntities) {
          const canonCompact = compactText(entity.canonicalName);
          const vnCompact = compactText(entity.vietnameseName);

          if (prodCompact.includes(canonCompact) || prodCompact.includes(vnCompact)) {
            score += 750;
            reasons.push(`verified_alias_${entity.id}`);
            break;
          }
        }

        // Matched brand
        if (resolution.matchedBrands.length > 0 && resolution.matchedBrands.includes(prodBrand)) {
          score += 300;
          reasons.push('verified_brand_match');
        }
      }

      // --- Tier 3: Direct Phrase / Substring match on Name ---
      if (normQuery && prodNorm.includes(normQuery)) {
        score += 650;
        reasons.push('exact_phrase_in_name');
      } else if (compactQuery && prodCompact.includes(compactQuery)) {
        score += 600;
        reasons.push('compact_match_in_name');
      } else if (coreCompact && prodCompact.includes(coreCompact)) {
        score += 550;
        reasons.push('core_compact_in_name');
      }

      // --- Tier 4: Order-Independent Token Coverage ---
      const coreTokens = resolution.coreTokens.length > 0 ? resolution.coreTokens : tokenize(trimmed);
      let matchedTokenCount = 0;

      for (const token of coreTokens) {
        const tokenCompact = compactText(token);
        if (
          prodCompact.includes(tokenCompact) ||
          prodModelCodeCompact.includes(tokenCompact) ||
          prodSkuCompact.includes(tokenCompact) ||
          prodBrandCompact.includes(tokenCompact)
        ) {
          matchedTokenCount++;
        }
      }

      if (matchedTokenCount === coreTokens.length && coreTokens.length > 0) {
        score += 400;
        reasons.push('all_core_tokens_matched');
      } else if (matchedTokenCount > 0) {
        score += matchedTokenCount * 70;
      }

      // --- Tier 5: Product Type / Descriptor Alignment ---
      if (resolution.descriptorTokens.length > 0) {
        const hasFigure = resolution.descriptorTokens.some((d) =>
          ['figure', 'fig', 'metalbuild', 'mb'].includes(compactText(d)),
        );
        const hasKit = resolution.descriptorTokens.some((d) => ['kit', 'laprap'].includes(compactText(d)));

        if (hasFigure) {
          const isFigureProduct =
            product.assemblyState === 'assembled' ||
            prodName.toLowerCase().includes('metal build') ||
            prodName.toLowerCase().includes('figure');
          if (isFigureProduct) {
            score += 60;
            reasons.push('descriptor_figure_matched');
          }
        }

        if (hasKit) {
          const isKitProduct = product.assemblyState === 'unassembled' || prodName.toLowerCase().includes('kit');
          if (isKitProduct) {
            score += 60;
            reasons.push('descriptor_kit_matched');
          }
        }
      }

      // --- Tie-breaking Quality Factors ---
      // In-stock products get priority
      if ((product.stock ?? 0) > 0) {
        score += 15;
      }
      // Modest popularity tie-breaker
      if ((product.sold ?? 0) > 0) {
        score += Math.min(10, (product.sold || 0) * 0.1);
      }

      // Only include products that meet minimum threshold (eliminating unrelated records)
      if (score >= 120) {
        scoredList.push({ product, score, matchReasons: reasons });
      }
    }

    // Sort by score descending, then in-stock, then sold, then id ascending
    scoredList.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aStock = (a.product.stock ?? 0) > 0 ? 1 : 0;
      const bStock = (b.product.stock ?? 0) > 0 ? 1 : 0;
      if (bStock !== aStock) return bStock - aStock;
      const aSold = a.product.sold ?? 0;
      const bSold = b.product.sold ?? 0;
      if (bSold !== aSold) return bSold - aSold;
      return a.product.id - b.product.id;
    });

    return scoredList.map((item) => item.product);
  }
}

export default ProductSearchService;
