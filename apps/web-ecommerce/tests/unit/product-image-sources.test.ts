import {
  classifyLink,
  differenceHash,
  driveDownloadUrl,
  extractPageImages,
  sameShot,
  splitLinks,
} from '../../src/core/server/services/catalog/ProductImageSources';

describe('product image sources of the owner workbook', () => {
  it('splits a cell into unique links', () => {
    expect(splitLinks('https://a.vn/x.jpg, https://b.vn/page\nhttps://a.vn/x.jpg; (https://c.vn/y.png). text')).toEqual(
      ['https://a.vn/x.jpg', 'https://b.vn/page', 'https://c.vn/y.png'],
    );
    expect(splitLinks('no link')).toEqual([]);
  });

  it('classifies direct images, pages, Facebook, Drive and other links', () => {
    expect(classifyLink('https://bizweb.dktcdn.net/100/1/products/cd-01.jpg?v=2')).toBe('direct');
    expect(classifyLink('https://scontent.fhan3-3.fna.fbcdn.net/v/t39/123_n.jpg?stp=x')).toBe('direct');
    expect(classifyLink('https://down-vn.img.susercontent.com/file/abc123')).toBe('direct');
    expect(classifyLink('https://gundamchat.com/mo-hinh-cd-01u')).toBe('page');
    expect(classifyLink('https://www.facebook.com/gundamstorevn/posts/123/')).toBe('facebook');
    expect(classifyLink('https://drive.google.com/file/d/1AbCdEfGhIjK/view')).toBe('drive');
    expect(classifyLink('https://www.instagram.com/p/xyz/')).toBe('other');
    expect(classifyLink('not a url')).toBe('other');
  });

  it('turns a Drive file link into its download link, and leaves folders to a person', () => {
    expect(driveDownloadUrl('https://drive.google.com/file/d/1AbCdEfGhIjK/view?usp=sharing')).toBe(
      'https://drive.google.com/uc?export=download&id=1AbCdEfGhIjK',
    );
    expect(driveDownloadUrl('https://drive.google.com/open?id=1AbCdEfGhIjK')).toBe(
      'https://drive.google.com/uc?export=download&id=1AbCdEfGhIjK',
    );
    expect(driveDownloadUrl('https://drive.google.com/drive/folders/1AbCdEfGhIjK')).toBeNull();
  });

  it('takes og:image, JSON-LD Product.image and the main gallery, without logos or other products', () => {
    const html = `
      <html><head>
        <meta property="og:image" content="//cdn.shop.vn/products/cd-01-main.jpg?v=1" />
        <meta name="twitter:image" content="https://cdn.shop.vn/products/cd-01-main.jpg?v=1">
        <script type="application/ld+json">{"@graph":[{"@type":"Organization","logo":"https://cdn.shop.vn/logo.png"},
          {"@type":"Product","image":["https://cdn.shop.vn/products/cd-01-side.jpg",{"@type":"ImageObject","url":"https://cdn.shop.vn/products/cd-01-back.jpg"}]}]}</script>
        <script type="application/ld+json">{ broken json </script>
      </head><body>
        <img src="/assets/logo.png"><img src="/related/other-kit.jpg">
        <div class="product-gallery swiper">
          <a href="/products/cd-01-zoom.jpg"><img src="data:image/gif;base64,R0" data-src="/products/cd-01-thumb.jpg"></a>
          <img src="/icons/zoom.svg"><img src="/products/cd-01-tiny.jpg" width="80">
        </div>
      </body></html>`;
    expect(extractPageImages(html, 'https://shop.vn/cd-01')).toEqual([
      'https://cdn.shop.vn/products/cd-01-main.jpg?v=1',
      'https://cdn.shop.vn/products/cd-01-side.jpg',
      'https://cdn.shop.vn/products/cd-01-back.jpg',
      'https://shop.vn/products/cd-01-zoom.jpg',
      'https://shop.vn/products/cd-01-thumb.jpg',
    ]);
    expect(extractPageImages('<img src="/a.jpg">', 'https://shop.vn/x')).toEqual([]);
  });

  it('stops the gallery at its own closing tag, before related products', () => {
    const html = `<div class="product-gallery"><div><img src="/p/main.jpg"></div><img src="/p/side.jpg"></div>
      <div class="related"><img src="/p/other-kit.jpg"></div>`;
    expect(extractPageImages(html, 'https://shop.vn/x')).toEqual([
      'https://shop.vn/p/main.jpg',
      'https://shop.vn/p/side.jpg',
    ]);
  });

  it('recognises the same shot at another size by its difference hash', () => {
    const gradient = Uint8Array.from({ length: 72 }, (_, index) => (index * 37) % 251);
    const brighter = gradient.map((value) => Math.min(255, value + 3));
    const other = Uint8Array.from({ length: 72 }, (_, index) => (index * 91) % 241);
    expect(differenceHash(gradient)).toHaveLength(64);
    expect(sameShot(differenceHash(gradient), differenceHash(brighter))).toBe(true);
    expect(sameShot(differenceHash(gradient), differenceHash(other))).toBe(false);
  });
});
