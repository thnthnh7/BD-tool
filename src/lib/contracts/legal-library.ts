/**
 * Thư viện điều khoản hỗ trợ soạn HĐ dịch vụ phát triển PM (VN).
 * Đây là template hỗ trợ soạn thảo — không thay thế tư vấn luật sư.
 */

export type LegalClause = {
  id: string;
  title: string;
  legalBasis: string;
  body: string;
};

export const LEGAL_DISCLAIMER =
  "Tài liệu này được tạo tự động để hỗ trợ soạn thảo hợp đồng. Vui lòng rà soát pháp lý trước khi ký kết.";

export const legalClauseLibrary: LegalClause[] = [
  {
    id: "definitions",
    title: "Định nghĩa",
    legalBasis: "BLDS 2015 – giải thích thuật ngữ hợp đồng",
    body: "Các thuật ngữ Dịch vụ, Tài nguyên, Mã nguồn được hiểu theo thỏa thuận và Phụ lục đính kèm.",
  },
  {
    id: "scope",
    title: "Phạm vi dịch vụ & tính toàn vẹn hợp đồng",
    legalBasis: "BLDS 2015; Luật Thương mại 2005",
    body: "Hợp đồng và Phụ lục là toàn bộ thỏa thuận. Mọi thay đổi phải lập thành văn bản có chữ ký đại diện có thẩm quyền.",
  },
  {
    id: "software-product",
    title: "Sản phẩm phần mềm & quy trình sản xuất",
    legalBasis: "Thông tư 20/2021/TT-BTTTT (danh mục sản phẩm phần mềm)",
    body: "Sản phẩm thuộc nhóm phần mềm quản trị. Quy trình gồm: xác định yêu cầu, phân tích thiết kế, lập trình, kiểm thử, bàn giao, bảo trì.",
  },
  {
    id: "ip",
    title: "Sở hữu trí tuệ",
    legalBasis: "Luật Sở hữu trí tuệ (sửa đổi)",
    body: "Thành phần tùy chỉnh chuyển giao sau khi thanh toán đủ. Tài sản trí tuệ nền tảng thuộc Công ty; Khách hàng được cấp quyền sử dụng không độc quyền để vận hành sản phẩm.",
  },
  {
    id: "confidentiality",
    title: "Bảo mật thông tin",
    legalBasis: "BLDS 2015; nghĩa vụ bảo mật theo thỏa thuận",
    body: "Các Bên không tiết lộ thông tin bí mật, trừ khi được phép hoặc theo yêu cầu pháp luật.",
  },
  {
    id: "payment",
    title: "Phí dịch vụ & thanh toán",
    legalBasis: "Luật Thương mại; thỏa thuận dân sự",
    body: "Phí theo Phụ lục. Thanh toán theo milestone. Chậm thanh toán có thể tạm dừng dịch vụ và tính lãi chậm trả theo thỏa thuận/pháp luật.",
  },
  {
    id: "penalty",
    title: "Phạt vi phạm & bồi thường",
    legalBasis: "BLDS 2015; Luật Thương mại (giới hạn phạt)",
    body: "Phạt vi phạm theo tỷ lệ thỏa thuận (mẫu: 8% giá trị nghĩa vụ bị vi phạm), không vượt mức tối đa pháp luật. Bồi thường thiệt hại thực tế, trực tiếp.",
  },
  {
    id: "force-majeure",
    title: "Bất khả kháng",
    legalBasis: "BLDS 2015",
    body: "Bên gặp sự kiện bất khả kháng được miễn trách trong phạm vi bị ảnh hưởng, phải thông báo kịp thời. Kéo dài quá 30 ngày có thể thanh lý HĐ.",
  },
  {
    id: "dispute",
    title: "Giải quyết tranh chấp",
    legalBasis: "BLTTDS; pháp luật Việt Nam",
    body: "Ưu tiên thương lượng/hòa giải. Không thành trong 60 ngày thì Tòa án nhân dân có thẩm quyền tại Việt Nam giải quyết.",
  },
  {
    id: "warranty",
    title: "Bảo hành & hỗ trợ",
    legalBasis: "Thỏa thuận dịch vụ; BLDS về nghĩa vụ bảo hành",
    body: "Bảo hành lỗi kỹ thuật trong phạm vi đã nghiệm thu theo thời hạn thỏa thuận (mẫu: 3 tháng, hỗ trợ 8x5). Ngoài phạm vi tính phí bổ sung.",
  },
];
