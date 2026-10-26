import {
  assertOwnerCatalogValid,
  loadOwnerCatalog,
  ownerKey,
  ownerProductValues,
  parseOwnerCatalogCsv,
  type OwnerCatalogRow,
} from '../../src/core/server/database/client/seeders/OwnerCatalog';
import { loadCatalogEntries } from '../../src/core/server/database/client/seeders/ModelUniverseCatalog';

const rows = loadOwnerCatalog();
const research = new Map(loadCatalogEntries().map((entry) => [entry.id, entry]));
const sum = (items: OwnerCatalogRow[], value: (row: OwnerCatalogRow) => number) =>
  items.reduce((total, row) => total + value(row), 0);

// The owner's workbook "Danh mục 6 hãng" exported on 2026-10-25 (seeders/data/owner-catalog.json).
describe("owner's catalogue workbook", () => {
  it('reproduces the figures of the sheet "Thống kê kho"', () => {
    expect(rows).toHaveLength(100);
    expect(sum(rows, (row) => row.stock)).toBe(26);
    expect(rows.filter((row) => row.stock > 0)).toHaveLength(15);
    expect(new Set(rows.map((row) => row.brand)).size).toBe(6);
    expect(sum(rows, (row) => (row.buyInVnd ?? 0) * row.stock)).toBe(18_550_000);
    // S of the workbook of 26/10/2026; the recorded costs H are those before it (not recalculated).
    expect(sum(rows, (row) => (row.memberPriceVnd ?? 0) * row.stock)).toBe(23_550_000);
    const byBrand = (brand: string) => rows.filter((row) => row.brand === brand);
    expect(
      ['Cangdao', 'Motor Nuclear', 'SNAA', 'IN ERA+', 'HEMOXIAN', 'MOSHOW'].map((brand) => [
        byBrand(brand).length,
        byBrand(brand).filter((row) => row.stock > 0).length,
        sum(byBrand(brand), (row) => row.stock),
      ]),
    ).toEqual([
      [17, 1, 2],
      [39, 8, 13],
      [15, 2, 3],
      [4, 2, 3],
      [4, 2, 5],
      [21, 0, 0],
    ]);
  });

  it('passes its invariants, with keys of researched models or derived from the name', () => {
    expect(() => assertOwnerCatalogValid(rows)).not.toThrow();
    for (const row of rows) {
      if (row.key.startsWith('owner-')) expect(row.key).toBe(ownerKey(row.name));
      else expect(research.get(row.key)?.brand).toBe(row.brand);
    }
  });

  // Owner rule of 2026-10-25: the sheet's price is S awaiting approval and its R column is empty, so the shop sells at S.
  // Owner rule of 2026-10-26: the sheet's S is entered; the web price R = ROUND(S / 0.9) and B by three rates follow it.
  it('prices from S: the web price R = S ÷ 0.9 and the buyback price S − margin', () => {
    const kit = ownerProductValues(rows.find((row) => row.name.startsWith('MNP-XH01 - '))!);
    expect(kit).toMatchObject({
      price: 722_222,
      listPriceVerified: true,
      importPrice: 450_000,
      pricingReferenceMemberVnd: 650_000,
      buybackPriceVnd: 520_000,
      scale: '1/100',
      stock: 1,
    });
    const starColor = ownerProductValues(rows.find((row) => row.name.startsWith('MNQ-XH05CX'))!);
    expect(starColor).toMatchObject({ price: 44_444_444, buybackPriceVnd: 33_200_000 });
  });

  it('takes the box, received date and condition from the sheet and leaves the category empty', () => {
    const figure = ownerProductValues(rows[0]);
    expect(figure).toMatchObject({
      name: 'CD-01 - Azure Dragon / Thanh Long (màu gốc)',
      brandName: 'Cangdao',
      modelCode: 'CD-01',
      condition: 'new',
      assemblyState: 'assembled',
      categoryId: null,
      packaging: { lengthCm: 30, widthCm: 20, heightCm: 15, weightGram: 4000, fragile: true, orientation: 'flat' },
      dimensions: '30 × 20 × 15 cm',
      weight: '4 kg',
    });
    expect(figure.productionDate.toISOString()).toBe('2026-10-24T17:00:00.000Z');
    // A name in styled Unicode letters is stored as plain text.
    expect(rows.at(-1)!.name).toBe("MOSHOW TOYS x MECHA BREAK 1/64 Collector's Box : Falcon Custom");
  });

  it('reads a CSV export by its headers, keeping known keys and ignoring the image column', () => {
    const csv = [
      'Tên sản phẩm (mã + tên + phiên bản màu),Tên hãng,Tỉ lệ mô hình,Khối lượng mặc định (kg),Dài mặc định (cm),Rộng mặc định (cm),Cao mặc định (cm),Giá nhập/thu ghi nhận H (VNĐ; cần đối soát),Giá bán thực S (VNĐ) – NHẬP,Giá lời B (VNĐ) – TỰ TÍNH,Giá web R (VNĐ) – TỰ TÍNH,C50 – Giá cầm dự kiến = 50% S,Số lượng tồn,Tình trạng,Ảnh / liên kết ảnh,Ngày nhập kho,Số ngày tồn kho,Duyệt giá/đăng bán',
      'CD-01B - Azure Dragon / Black Dragon (Nemesis Black),Cangdao,1/72,4,30,20,15,"2,300,000 ₫","2,700,000 ₫","459,000 ₫","3,000,000 ₫","1,350,000 ₫",2,,https://example.test/a.jpg,25/10/2026,1,CHỜ DUYỆT',
      'SC-099 - Fixture Knight,SNAA,1/144,"1,5",15,10,10,"100,000 ₫","200,000 ₫",,,,3,Thiếu phụ kiện,,01/11/2026,,CHỜ DUYỆT',
    ].join('\n');
    const [known, added] = parseOwnerCatalogCsv(csv, rows);
    expect(known).toEqual(rows.find((row) => row.key === 'cd-cd-01b-black-version'));
    expect(added).toEqual({
      key: 'owner-sc-099-fixture-knight',
      name: 'SC-099 - Fixture Knight',
      manufacturerSku: 'SC-099',
      brand: 'SNAA',
      productType: 'kit',
      scale: '1/144',
      weightGram: 1500,
      lengthCm: 15,
      widthCm: 10,
      heightCm: 10,
      buyInVnd: 100_000,
      memberPriceVnd: 200_000,
      stock: 3,
      condition: 'incomplete',
      receivedOn: '2026-11-01',
    });
    expect(() => parseOwnerCatalogCsv(csv.replace('Thiếu phụ kiện', 'Hàng trưng bày'), rows)).toThrow(
      /Unknown condition/,
    );
  });

  it('refuses rows that cannot be published as they are', () => {
    const valid = rows[0];
    expect(() => assertOwnerCatalogValid([valid, { ...valid, key: 'other' }])).toThrow(/Duplicate/);
    expect(() => assertOwnerCatalogValid([{ ...valid, memberPriceVnd: null }])).toThrow(/selling price/);
    expect(() => assertOwnerCatalogValid([{ ...valid, stock: -1 }])).toThrow(/stock/);
    // A second-hand unit is unique and photographed: Admin adds it, never a bulk import.
    expect(() => assertOwnerCatalogValid([{ ...valid, condition: 'preowned' }])).toThrow(/Admin/);
  });
});
