import {
  compactText,
  normalizeSearchText,
  removeDiacritics,
  tokenize,
} from '../../src/shared/search/textNormalizer';
import AliasDictionary from '../../src/shared/search/aliasDictionary';
import ProductSearchService from '../../src/core/server/services/catalog/ProductSearchService';

describe('Product Name Variants and Search Aliases', () => {
  describe('Text Normalizer', () => {
    it('removes Vietnamese diacritics and handles đ/Đ correctly', () => {
      expect(removeDiacritics('Ngao Bính')).toBe('Ngao Binh');
      expect(removeDiacritics('Na Tra')).toBe('Na Tra');
      expect(removeDiacritics('Điển Vi')).toBe('Dien Vi');
      expect(removeDiacritics('Lữ Bố')).toBe('Lu Bo');
      expect(removeDiacritics('Tào Nhân')).toBe('Tao Nhan');
      expect(removeDiacritics('Bạch Khởi')).toBe('Bach Khoi');
    });

    it('compacts text across case, spacing, and accents', () => {
      expect(compactText('Ao Bing')).toBe('aobing');
      expect(compactText('Ao Binh')).toBe('aobinh');
      expect(compactText('aobing')).toBe('aobing');
      expect(compactText('AoBing')).toBe('aobing');
      expect(compactText('ngao bính')).toBe('ngaobinh');
      expect(compactText('Natra')).toBe('natra');
      expect(compactText('na tra')).toBe('natra');
      expect(compactText('Na Tra')).toBe('natra');
    });

    it('tokenizes and normalizes keywords consistently', () => {
      expect(tokenize('na tra mô hình')).toEqual(['na', 'tra', 'mo', 'hinh']);
      expect(tokenize('mô hình natra')).toEqual(['mo', 'hinh', 'natra']);
      expect(tokenize('aobing figure')).toEqual(['aobing', 'figure']);
      expect(tokenize('figure aobing')).toEqual(['figure', 'aobing']);
    });
  });

  describe('Alias Dictionary & Transliteration Resolution', () => {
    it('resolves all variations of Ao Bing / Ngao Bính to the same character entity', () => {
      const variants = ['Ao Binh', 'aobing', 'AoBing', 'ngao bính', 'Ngao Binh', 'ngaobinh'];
      for (const query of variants) {
        const res = AliasDictionary.resolveQuery(query);
        expect(res.isVerifiedAliasMatch).toBe(true);
        expect(res.matchedEntities.length).toBeGreaterThan(0);
        expect(res.matchedEntities[0].id).toBe('ao-bing');
        expect(res.targetModelCodes).toContain('MNP-XH03');
      }
    });

    it('resolves all variations of Natra / Na Tra to the same character entity', () => {
      const variants = ['Natra', 'natra', 'na tra', 'Na Tra', 'Nezha', 'nezha'];
      for (const query of variants) {
        const res = AliasDictionary.resolveQuery(query);
        expect(res.isVerifiedAliasMatch).toBe(true);
        expect(res.matchedEntities.length).toBeGreaterThan(0);
        expect(res.matchedEntities[0].id).toBe('ne-zha');
        expect(res.targetModelCodes).toContain('MNP-XH04');
      }
    });

    it('handles token order independence for "na tra mô hình" and "mô hình natra"', () => {
      const res1 = AliasDictionary.resolveQuery('na tra mô hình');
      const res2 = AliasDictionary.resolveQuery('mô hình natra');

      expect(res1.isVerifiedAliasMatch).toBe(true);
      expect(res2.isVerifiedAliasMatch).toBe(true);
      expect(res1.matchedEntities[0].id).toBe('ne-zha');
      expect(res2.matchedEntities[0].id).toBe('ne-zha');
      expect(res1.targetModelCodes).toEqual(expect.arrayContaining(['MNP-XH04']));
      expect(res2.targetModelCodes).toEqual(expect.arrayContaining(['MNP-XH04']));
    });

    it('handles token order independence for "aobing figure" and "figure aobing"', () => {
      const res1 = AliasDictionary.resolveQuery('aobing figure');
      const res2 = AliasDictionary.resolveQuery('figure aobing');

      expect(res1.isVerifiedAliasMatch).toBe(true);
      expect(res2.isVerifiedAliasMatch).toBe(true);
      expect(res1.matchedEntities[0].id).toBe('ao-bing');
      expect(res2.matchedEntities[0].id).toBe('ao-bing');
      expect(res1.targetModelCodes).toEqual(expect.arrayContaining(['MNP-XH03']));
      expect(res2.targetModelCodes).toEqual(expect.arrayContaining(['MNP-XH03']));
    });

    it('supports dynamic extension of aliases for existing and new products', () => {
      AliasDictionary.registerProductAlias('TEST-SKU-99', 'Rồng Lửa Siêu Cấp');
      const res = AliasDictionary.resolveQuery('Rồng Lửa Siêu Cấp');
      expect(res.expandedKeywords).toContain('Rồng Lửa Siêu Cấp');
    });
  });

  describe('Relevance Ranking and Filtering', () => {
    const mockProducts = [
      {
        id: 1,
        name: 'MNP-XH03 - Ao Bing / Ngao Bính (màu gốc)',
        modelCode: 'MNP-XH03',
        sku: 'MNP-XH03-01',
        brandName: 'Motor Nuclear',
        stock: 5,
        sold: 20,
        assemblyState: 'unassembled',
      },
      {
        id: 2,
        name: 'MNQ-XH03 - Ao Bing / Ngao Bính (Metal Build Figure)',
        modelCode: 'MNQ-XH03',
        sku: 'MNQ-XH03-01',
        brandName: 'Motor Nuclear',
        stock: 2,
        sold: 10,
        assemblyState: 'assembled',
      },
      {
        id: 3,
        name: 'MNP-XH04 - Ne Zha / Na Tra (màu gốc)',
        modelCode: 'MNP-XH04',
        sku: 'MNP-XH04-01',
        brandName: 'Motor Nuclear',
        stock: 4,
        sold: 15,
        assemblyState: 'unassembled',
      },
      {
        id: 4,
        name: 'MNP-XH01 - Bai Qi / Bạch Khởi (màu gốc)',
        modelCode: 'MNP-XH01',
        sku: 'MNP-XH01-01',
        brandName: 'Motor Nuclear',
        stock: 1,
        sold: 5,
        assemblyState: 'unassembled',
      },
      {
        id: 5,
        name: 'Mô hình lắp ráp Gundam Dynames',
        modelCode: 'GN-002',
        sku: 'GUNDAM-DYNAMES',
        brandName: 'Bandai',
        stock: 3,
        sold: 8,
        assemblyState: 'unassembled',
      },
    ];

    it('ranks exact and verified alias matches higher than non-matches for "aobing"', () => {
      const ranked = ProductSearchService.rankCandidates(mockProducts, 'aobing');
      expect(ranked.length).toBe(2);
      expect(ranked.map((p) => p.modelCode)).toEqual(['MNP-XH03', 'MNQ-XH03']);
      // Ne Zha, Bai Qi, and Gundam Dynames should NOT match falsely
      expect(ranked.some((p) => p.modelCode === 'MNP-XH04')).toBe(false);
      expect(ranked.some((p) => p.modelCode === 'MNP-XH01')).toBe(false);
    });

    it('ranks exact and verified alias matches for "Natra"', () => {
      const ranked = ProductSearchService.rankCandidates(mockProducts, 'Natra');
      expect(ranked.length).toBe(1);
      expect(ranked[0].modelCode).toBe('MNP-XH04');
    });

    it('prioritizes figure/assembled versions when "figure" is in the query "aobing figure"', () => {
      const ranked = ProductSearchService.rankCandidates(mockProducts, 'aobing figure');
      expect(ranked.length).toBe(2);
      // Figure / Metal Build version should be boosted ahead of or at top
      expect(ranked[0].modelCode).toBe('MNQ-XH03');
    });

    it('produces identical top results for "na tra mô hình" and "mô hình natra"', () => {
      const ranked1 = ProductSearchService.rankCandidates(mockProducts, 'na tra mô hình');
      const ranked2 = ProductSearchService.rankCandidates(mockProducts, 'mô hình natra');

      expect(ranked1.length).toBe(1);
      expect(ranked2.length).toBe(1);
      expect(ranked1[0].id).toBe(ranked2[0].id);
      expect(ranked1[0].modelCode).toBe('MNP-XH04');
    });

    it('does not falsely match unrelated products (no hallucinated overlap)', () => {
      const ranked = ProductSearchService.rankCandidates(mockProducts, 'Gundam Dynames');
      expect(ranked.length).toBe(1);
      expect(ranked[0].name).toContain('Gundam Dynames');
    });
  });
});
