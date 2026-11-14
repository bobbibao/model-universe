// The guides at /huong-dan: plain answers to the questions people ask before buying, building or selling a kit.
// Each guide is written to be quoted: a short direct answer first, then sections, then its own questions. Shop
// facts (conditions, services) repeat only what the product and service pages already state; the rest is general
// hobby knowledge. Text is Vietnamese (the shop's customers); prices and offers never appear here because they change.

export interface GuideSection {
  heading: string;
  paragraphs: string[];
  list?: string[];
}

export interface Guide {
  slug: string;
  title: string;
  description: string;
  // The direct answer shown first and used as the search description.
  answer: string;
  updated: string; // ISO date of the last edit
  sections: GuideSection[];
  questions: { question: string; answer: string }[];
  related: { label: string; path: string }[];
}

export const GUIDES: Guide[] = [
  {
    slug: 'gunpla-la-gi-phan-biet-hg-rg-mg-pg',
    title: 'Gunpla là gì? Phân biệt HG, RG, MG, PG, SD và EG',
    description:
      'Gunpla là mô hình nhựa lắp ráp Gundam của Bandai. Phân biệt các dòng HG, RG, MG, PG, SD, EG theo tỷ lệ, độ chi tiết và độ khó để chọn đúng kit.',
    answer:
      'Gunpla (Gundam Plastic Model) là mô hình nhựa lắp ráp của Bandai, lắp bằng cách cắt chi tiết khỏi khung nhựa rồi ráp khớp, không cần keo. Các dòng chính khác nhau ở tỷ lệ và độ chi tiết: HG 1/144 dễ lắp, RG 1/144 chi tiết cao, MG 1/100 có khung xương, PG 1/60 lớn và phức tạp nhất, SD dáng chibi, EG dành cho người mới.',
    updated: '2026-11-14',
    sections: [
      {
        heading: 'Các dòng Gunpla và tỷ lệ',
        paragraphs: [
          'Tỷ lệ cho biết mô hình nhỏ hơn "bản thật" trong phim bao nhiêu lần: 1/144 cao khoảng 12–14 cm, 1/100 khoảng 18–20 cm, 1/60 khoảng 30 cm.',
        ],
        list: [
          'EG (Entry Grade), 1/144: ít chi tiết, lắp bằng tay, không cần dụng cụ. Hợp làm kit đầu tiên.',
          'HG (High Grade), 1/144: dòng phổ biến nhất, nhiều mẫu nhất, lắp trong một buổi.',
          'RG (Real Grade), 1/144: kích thước của HG nhưng chi tiết và phân màu gần với MG; chi tiết nhỏ, cần kiên nhẫn.',
          'MG (Master Grade), 1/100: có khung xương bên trong, khớp linh hoạt, nhiều chi tiết cơ khí.',
          'PG (Perfect Grade), 1/60: lớn, phức tạp và nhiều chi tiết nhất; thường dành cho người đã có kinh nghiệm.',
          'SD (Super Deformed): dáng đầu to thân nhỏ, không theo tỷ lệ, lắp nhanh.',
        ],
      },
      {
        heading: 'Chọn dòng nào theo nhu cầu',
        paragraphs: [
          'Muốn lắp nhanh và sưu tầm nhiều mẫu thì chọn HG. Muốn một mô hình trưng bày đẹp, có chiều sâu cơ khí thì chọn MG. RG hợp với người thích chi tiết nhưng không có nhiều chỗ trưng bày. PG là lựa chọn cho một dự án dài ngày.',
          'Ngoài Bandai, nhiều hãng khác cũng làm mô hình mecha lắp ráp với thiết kế riêng, ví dụ các dòng kit Trung Quốc như Motor Nuclear, CangDao hay Moshow.',
        ],
      },
    ],
    questions: [
      {
        question: 'Lắp Gunpla có cần keo và sơn không?',
        answer:
          'Không bắt buộc. Gunpla được thiết kế để ráp khớp không cần keo và nhựa đã có màu sẵn. Sơn, kẻ lằn chìm và phủ bóng là các bước làm đẹp thêm, tuỳ người chơi.',
      },
      {
        question: 'HG và RG cùng tỷ lệ 1/144 thì khác gì nhau?',
        answer:
          'Cùng kích thước, nhưng RG có nhiều chi tiết hơn, phân màu kỹ hơn và khớp phức tạp hơn. HG ít chi tiết hơn nên dễ và nhanh lắp hơn.',
      },
    ],
    related: [
      { label: 'Xem tất cả mô hình đang bán', path: '/cua-hang' },
      { label: 'Người mới nên mua mô hình nào?', path: '/huong-dan/nguoi-moi-nen-mua-mo-hinh-nao' },
    ],
  },
  {
    slug: 'nguoi-moi-nen-mua-mo-hinh-nao',
    title: 'Người mới nên mua mô hình nào? Cách chọn kit đầu tiên',
    description:
      'Cách chọn mô hình lắp ráp đầu tiên: bắt đầu từ kit ít chi tiết, đúng ngân sách, đúng mẫu mình thích, và những điều cần biết khi mua hàng 2hand.',
    answer:
      'Người mới nên bắt đầu với một kit ít chi tiết, lắp không cần keo và không quá đắt, ví dụ dòng EG hoặc HG tỷ lệ 1/144. Chọn mẫu mình thật sự thích để có động lực lắp xong, rồi mới lên các dòng nhiều chi tiết hơn như RG hay MG.',
    updated: '2026-11-14',
    sections: [
      {
        heading: 'Ba tiêu chí chọn kit đầu tiên',
        paragraphs: [],
        list: [
          'Độ khó: kit càng nhiều chi tiết nhỏ càng dễ nản. Dòng ít chi tiết giúp làm quen với cách cắt, gọt và ráp.',
          'Ngân sách: tính cả dụng cụ cơ bản (kìm cắt, dao gọt). Một kit vừa túi tiền lắp xong vẫn hơn một kit đắt bỏ dở.',
          'Sở thích: chọn mẫu mình thích trong phim, game hoặc đơn giản là thấy đẹp.',
        ],
      },
      {
        heading: 'Mua mới hay mua 2hand',
        paragraphs: [
          'Hàng mới còn nguyên khung nhựa, hợp với người muốn tự lắp từ đầu. Hàng 2hand thường rẻ hơn và có cả mẫu đã ngừng sản xuất; có thể chưa ráp hoặc đã ráp sẵn.',
          'Tại Model Universe, mỗi món 2hand ghi rõ tình trạng: đã ráp hay chưa, có thiếu phụ kiện hay có lỗi gì. Hãy đọc phần tình trạng của đúng món mình chọn trước khi đặt.',
        ],
      },
      {
        heading: 'Cần tư vấn chọn mẫu',
        paragraphs: [
          'Trợ lý AI trên website có thể lọc mô hình theo ngân sách, hãng, tỷ lệ và tình trạng, rồi so sánh các mẫu đang bán. Bạn cũng có thể nhắn Zalo hoặc gọi hotline của shop.',
        ],
      },
    ],
    questions: [
      {
        question: 'Lắp một kit HG mất bao lâu?',
        answer:
          'Tuỳ mẫu và tay nghề, người mới thường lắp xong một kit HG trong khoảng 2 đến 5 giờ nếu chỉ cắt và ráp, chưa tính sơn hay kẻ lằn chìm.',
      },
      {
        question: 'Trẻ em có lắp được không?',
        answer:
          'Được với các kit ít chi tiết, nhưng dụng cụ cắt gọt sắc và chi tiết nhỏ dễ nuốt, nên cần người lớn hỗ trợ. Nhà sản xuất ghi độ tuổi khuyến nghị trên hộp.',
      },
    ],
    related: [
      { label: 'Hỏi trợ lý AI chọn mô hình', path: '/assistant' },
      { label: 'Dụng cụ lắp ráp cơ bản', path: '/huong-dan/dung-cu-lap-rap-mo-hinh-co-ban' },
      { label: 'Gunpla là gì? Phân biệt các dòng', path: '/huong-dan/gunpla-la-gi-phan-biet-hg-rg-mg-pg' },
    ],
  },
  {
    slug: 'dung-cu-lap-rap-mo-hinh-co-ban',
    title: 'Dụng cụ lắp ráp mô hình cơ bản cho người mới',
    description:
      'Những dụng cụ cần có để lắp mô hình: kìm cắt, dao gọt, giấy nhám, nhíp; và các bước làm đẹp thêm như kẻ lằn chìm, dán decal, phủ bóng.',
    answer:
      'Để lắp một mô hình nhựa chỉ cần ba thứ: kìm cắt nhựa để cắt chi tiết khỏi khung, dao gọt để xử lý vết cắt, và giấy nhám hoặc dũa để làm mịn. Nhíp, bút kẻ lằn chìm và sơn phủ là các dụng cụ thêm vào khi muốn mô hình đẹp hơn.',
    updated: '2026-11-14',
    sections: [
      {
        heading: 'Bộ dụng cụ tối thiểu',
        paragraphs: [],
        list: [
          'Kìm cắt nhựa (nipper): cắt chi tiết khỏi khung. Cắt cách chi tiết một đoạn ngắn rồi mới cắt sát để tránh trắng nhựa.',
          'Dao gọt (dao trổ): gọt phần nhựa thừa còn lại ở vết cắt.',
          'Giấy nhám hoặc dũa: làm mịn vết cắt, dùng độ nhám tăng dần.',
        ],
      },
      {
        heading: 'Dụng cụ nên có thêm',
        paragraphs: [],
        list: [
          'Nhíp: dán decal và gắn chi tiết nhỏ.',
          'Bút kẻ lằn chìm (panel line): làm nổi các đường rãnh trên giáp.',
          'Sơn phủ (topcoat) mờ hoặc bóng: bảo vệ bề mặt, giữ decal và giảm độ bóng của nhựa.',
          'Thảm cắt và hộp chia ngăn: giữ bàn làm việc gọn và không lạc chi tiết.',
        ],
      },
      {
        heading: 'Thứ tự lắp cơ bản',
        paragraphs: [
          'Làm theo sách hướng dẫn trong hộp: cắt chi tiết theo số, xử lý vết cắt, ráp từng cụm (đầu, thân, tay, chân, vũ khí) rồi ghép lại. Kẻ lằn chìm và dán decal trước khi phủ topcoat.',
        ],
      },
    ],
    questions: [
      {
        question: 'Không có kìm chuyên dụng thì dùng kéo hay bấm móng tay được không?',
        answer:
          'Có thể cắt được nhưng dễ làm trắng nhựa, nứt hoặc để lại vết cắt xấu. Một chiếc kìm cắt nhựa cơ bản là dụng cụ đáng mua đầu tiên.',
      },
      {
        question: 'Có cần sơn mô hình không?',
        answer:
          'Không bắt buộc. Nhựa của kit đã có màu. Nhiều người chỉ kẻ lằn chìm và phủ một lớp topcoat mờ là mô hình đã khác hẳn.',
      },
    ],
    related: [
      { label: 'Người mới nên mua mô hình nào?', path: '/huong-dan/nguoi-moi-nen-mua-mo-hinh-nao' },
      { label: 'Liên hệ shop để được hỗ trợ lắp ráp', path: '/contact' },
    ],
  },
  {
    slug: 'kinh-nghiem-mua-mo-hinh-2hand',
    title: 'Kinh nghiệm mua mô hình 2hand: cần kiểm tra những gì',
    description:
      'Năm điểm cần kiểm tra khi mua mô hình lắp ráp 2hand: phụ kiện, khớp và nhựa, hộp và sách hướng dẫn, mức độ hoàn thiện, và mô tả tình trạng của người bán.',
    answer:
      'Khi mua mô hình 2hand, hãy kiểm tra năm điểm: phụ kiện và vũ khí có đủ không, khớp có lỏng hay gãy chốt không, nhựa có bị dán keo hay ố vàng không, còn hộp và sách hướng dẫn không, và mô hình đã ráp, sơn hay chỉnh sửa đến mức nào. Người bán đáng tin sẽ ghi rõ từng điểm này.',
    updated: '2026-11-14',
    sections: [
      {
        heading: 'Năm điểm cần kiểm tra',
        paragraphs: [],
        list: [
          'Phụ kiện và vũ khí: đối chiếu với danh sách trong sách hướng dẫn hoặc ảnh hộp.',
          'Khớp và chốt: khớp lỏng làm mô hình khó tạo dáng; chốt gãy thường phải dán keo.',
          'Bề mặt nhựa: vết dán keo, vết cắt xấu, trầy xước, ố vàng do nắng.',
          'Hộp và sách hướng dẫn: quan trọng với người sưu tầm và khi muốn bán lại.',
          'Mức độ hoàn thiện: chưa ráp, đã ráp, đã kẻ lằn chìm, đã sơn hoặc đã chỉnh sửa (custom).',
        ],
      },
      {
        heading: 'Cách Model Universe mô tả hàng 2hand',
        paragraphs: [
          'Mỗi món 2hand trên website là một sản phẩm riêng với tình trạng, giá và tồn kho của riêng nó: mới, 2hand, thiếu phụ kiện hoặc có lỗi, kèm ghi chú đã ráp hay chưa. Một mẫu có thể có nhiều món ở các tình trạng khác nhau; hãy chọn đúng món có tình trạng bạn chấp nhận.',
          'Ảnh của nhà sản xuất chỉ để tham khảo mẫu, không phải ảnh chứng minh tình trạng của một món 2hand cụ thể. Nếu cần ảnh thật, hãy nhắn shop trước khi đặt.',
        ],
      },
    ],
    questions: [
      {
        question: 'Mô hình 2hand thiếu phụ kiện có nên mua không?',
        answer:
          'Nên, nếu bạn không cần phụ kiện đó và giá đã phản ánh phần thiếu. Hãy đọc kỹ danh sách phụ kiện thiếu trong phần mô tả.',
      },
      {
        question: 'Muốn bán lại mô hình cũ thì làm thế nào?',
        answer:
          'Model Universe nhận thu mua và trade mô hình, kể cả hàng đã ráp, thiếu phụ kiện hoặc không hộp; giá được định theo tình trạng thực tế. Gửi yêu cầu kèm ảnh tại trang Thu mua.',
      },
    ],
    related: [
      { label: 'Mô hình đang bán tại shop', path: '/cua-hang' },
      { label: 'Thu mua mô hình', path: '/services/sell' },
      { label: 'Trade, đổi mô hình', path: '/services/trade' },
    ],
  },
  {
    slug: 'kit-trung-quoc-motor-nuclear-cangdao-moshow',
    title: 'Kit Trung Quốc là gì? Motor Nuclear, CangDao, Moshow khác gì Gunpla',
    description:
      'Kit Trung Quốc là mô hình mecha lắp ráp thiết kế gốc của các hãng như Motor Nuclear, CangDao, Moshow. Điểm khác so với Gunpla và lưu ý khi chọn mua.',
    answer:
      'Kit Trung Quốc ở đây là mô hình mecha lắp ráp do các hãng Trung Quốc tự thiết kế, như Motor Nuclear, CangDao và Moshow, không phải hàng nhái Gunpla. Nhiều mẫu lấy cảm hứng từ nhân vật lịch sử và thần thoại, có nhiều chi tiết giáp, và một số mẫu dùng khung hợp kim. Thông số của từng mẫu khác nhau nên cần đọc mô tả sản phẩm.',
    updated: '2026-11-14',
    sections: [
      {
        heading: 'Khác gì so với Gunpla',
        paragraphs: [],
        list: [
          'Thiết kế: nhân vật và cỗ máy gốc của từng hãng, nhiều mẫu theo chủ đề Tam Quốc, Tây Du Ký, tứ linh.',
          'Vật liệu: tuỳ mẫu, có thể là nhựa hoàn toàn hoặc kết hợp khung và chi tiết hợp kim.',
          'Độ khó: nhiều mẫu có số chi tiết lớn và nhiều lớp giáp, hợp với người đã lắp vài kit.',
          'Mã sản phẩm: mỗi hãng có cách đặt mã riêng (ví dụ MNP, MNQ của Motor Nuclear), tiện để tìm đúng mẫu và đúng phiên bản màu.',
        ],
      },
      {
        heading: 'Lưu ý khi chọn mua',
        paragraphs: [
          'Một mẫu thường có nhiều phiên bản màu hoặc bản đặc biệt, giá khác nhau. Hãy đối chiếu mã sản phẩm, phiên bản, tỷ lệ và tình trạng (mới hay 2hand, đã ráp hay chưa) trên trang sản phẩm.',
        ],
      },
    ],
    questions: [
      {
        question: 'Kit Trung Quốc có phải hàng nhái không?',
        answer:
          'Các hãng nêu trong bài (Motor Nuclear, CangDao, Moshow) sản xuất mô hình theo thiết kế riêng của họ, không phải bản sao của Gunpla.',
      },
      {
        question: 'Tìm một mẫu theo mã như MNP-XH03 ở đâu?',
        answer:
          'Nhập mã sản phẩm vào ô tìm kiếm của cửa hàng hoặc hỏi trợ lý AI trên website; mỗi trang sản phẩm ghi mã, hãng, tỷ lệ và tình trạng.',
      },
    ],
    related: [
      { label: 'Mô hình Motor Nuclear', path: '/cua-hang/mo-hinh-motor-nuclear' },
      { label: 'Mô hình CangDao', path: '/cua-hang/mo-hinh-cangdao' },
      { label: 'Mô hình Moshow', path: '/cua-hang/mo-hinh-moshow' },
    ],
  },
  {
    slug: 'cach-bao-quan-mo-hinh',
    title: 'Cách bảo quản mô hình: chống ẩm, bụi và ố vàng',
    description:
      'Bảo quản mô hình lắp ráp đúng cách: tránh nắng trực tiếp, chống ẩm, chống bụi, vệ sinh và tạo dáng để khớp không lỏng, nhựa không ố vàng.',
    answer:
      'Để mô hình bền đẹp, hãy đặt nơi khô ráo, tránh nắng trực tiếp và bụi: dùng tủ kính hoặc hộp trưng bày, thêm gói hút ẩm ở nơi ẩm, và lau bụi định kỳ bằng chổi lông mềm. Nắng và nhiệt làm nhựa ố vàng và giòn; ẩm làm bong decal và gỉ chi tiết kim loại.',
    updated: '2026-11-14',
    sections: [
      {
        heading: 'Ba kẻ thù của mô hình',
        paragraphs: [],
        list: [
          'Nắng và nhiệt: tia UV làm nhựa trắng ngả vàng, màu bạc đi; không đặt cạnh cửa sổ có nắng chiếu trực tiếp.',
          'Độ ẩm: làm bong decal, mốc hộp và gỉ các chi tiết kim loại; dùng gói hút ẩm hoặc tủ chống ẩm.',
          'Bụi: bám vào khe giáp và khó lau; tủ kính kín giúp giảm nhiều công vệ sinh.',
        ],
      },
      {
        heading: 'Vệ sinh và tạo dáng',
        paragraphs: [
          'Lau bụi bằng chổi lông mềm hoặc bóng thổi bụi. Không dùng dung môi mạnh vì có thể làm hỏng nhựa, sơn và decal.',
          'Tạo dáng quá căng trong thời gian dài làm khớp nhanh lỏng. Với mô hình nặng, dùng đế đỡ để giảm tải cho khớp chân.',
        ],
      },
      {
        heading: 'Giữ hộp và sách hướng dẫn',
        paragraphs: [
          'Hộp, sách hướng dẫn và phụ kiện thừa nên được giữ lại. Mô hình còn đủ hộp và phụ kiện được định giá tốt hơn khi bán lại, trade hoặc cầm cố.',
        ],
      },
    ],
    questions: [
      {
        question: 'Nhựa đã ố vàng có phục hồi được không?',
        answer:
          'Khó phục hồi hoàn toàn. Cách chắc chắn nhất là phòng từ đầu: tránh nắng trực tiếp và phủ topcoat có chống UV nếu sơn phủ.',
      },
      {
        question: 'Có nên tháo mô hình ra cất hộp khi không trưng bày?',
        answer:
          'Có thể. Tháo thành cụm lớn, bọc riêng từng cụm và để gói hút ẩm trong hộp; tránh tháo các khớp chặt nhiều lần vì dễ mòn chốt.',
      },
    ],
    related: [
      { label: 'Thu mua mô hình', path: '/services/sell' },
      { label: 'Cầm cố mô hình', path: '/services/pawn' },
      { label: 'Kinh nghiệm mua mô hình 2hand', path: '/huong-dan/kinh-nghiem-mua-mo-hinh-2hand' },
    ],
  },
];

export const findGuide = (slug: string) => GUIDES.find((guide) => guide.slug === slug);
