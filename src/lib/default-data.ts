import type { AppData, CompanySettings, ServiceModule } from "./types";

export const defaultSettings: CompanySettings = {
  companyName: "CÔNG TY TNHH CAP SAINT JACQUES TEK",
  shortName: "Cap Saint Jacques Tek",
  taxCode: "0319520814",
  address:
    "Tầng 1, Số 207A Nguyễn Văn Thủ, Phường Tân Định, Thành phố Hồ Chí Minh, Việt Nam",
  email: "",
  phone: "",
  website: "",
  logoPath: "/brand/logo.jpg",
  accentColor: "#2FF29E",
  currency: "VND",
  vatRate: 0,
  quoteValidityDays: 30,
  about:
    "Cap Saint Jacques Tek cung cấp dịch vụ tư vấn, thiết kế và phát triển phần mềm theo nhu cầu, tập trung vào giải pháp thực tế, dễ vận hành và có khả năng mở rộng.",
  terms: [
    "Báo giá có hiệu lực trong vòng 30 ngày kể từ ngày phát hành.",
    "Phạm vi công việc có thể được điều chỉnh theo phản hồi và yêu cầu thực tế của khách hàng.",
    "Chi phí chưa bao gồm các dịch vụ bên thứ ba như hosting, domain, SMS, email, payment gateway hoặc license phần mềm nếu có.",
    "Tiến độ triển khai phụ thuộc vào thời gian phản hồi, cung cấp tài liệu và nghiệm thu của hai bên.",
  ],
  legalRepresentative: "TRẦN THIÊN PHƯỚC",
  legalRepresentativeTitle: "Giám đốc",
  bankAccountNumber: "",
  bankAccountName: "CÔNG TY TNHH CAP SAINT JACQUES TEK",
  bankName: "",
  contractNumberPrefix: "HDDV-CJTEK",
  defaultWarrantyMonths: 3,
  defaultMaintenanceFee: 2000000,
};

export const defaultModules: ServiceModule[] = [
  {
    id: "discovery-workshop",
    name: "Discovery & Requirement Workshop",
    category: "Discovery",
    description:
      "Phân tích nhu cầu, mục tiêu kinh doanh, luồng người dùng và phạm vi MVP trước khi triển khai.",
    suggestedPrice: 8000000,
    defaultQty: 1,
    visualHint: "Workshop, scope map, user flows",
  },
  {
    id: "uiux-design",
    name: "UI/UX Design",
    category: "Product",
    description:
      "Thiết kế wireframe, giao diện chính, design system cơ bản và prototype để review trước khi dev.",
    suggestedPrice: 25000000,
    defaultQty: 1,
    visualHint: "Wireframe, prototype, component library",
  },
  {
    id: "landing-page",
    name: "Landing Page / Marketing Website",
    category: "Product",
    description:
      "Xây dựng landing page hoặc website giới thiệu dịch vụ, responsive và tối ưu tốc độ tải.",
    suggestedPrice: 18000000,
    defaultQty: 1,
    visualHint: "Hero, sections, CTA, responsive",
  },
  {
    id: "auth-user",
    name: "User Authentication",
    category: "User",
    description:
      "Đăng ký, đăng nhập, quên mật khẩu, phân quyền cơ bản và bảo vệ trang riêng tư.",
    suggestedPrice: 22000000,
    defaultQty: 1,
    visualHint: "Login, signup, roles",
  },
  {
    id: "profile-management",
    name: "User Profile Management",
    category: "User",
    description:
      "Cho phép người dùng xem và cập nhật thông tin cá nhân, avatar, mật khẩu và cài đặt tài khoản.",
    suggestedPrice: 12000000,
    defaultQty: 1,
    visualHint: "Profile, settings, account data",
  },
  {
    id: "admin-dashboard",
    name: "Admin Dashboard",
    category: "Admin",
    description:
      "Dashboard quản trị để theo dõi dữ liệu, quản lý người dùng, nội dung và trạng thái hệ thống.",
    suggestedPrice: 28000000,
    defaultQty: 1,
    visualHint: "KPIs, tables, filters, actions",
  },
  {
    id: "cms",
    name: "Content Management",
    category: "Admin",
    description:
      "Quản lý nội dung, banner, bài viết, danh mục hoặc cấu hình hiển thị mà không cần can thiệp code.",
    suggestedPrice: 18000000,
    defaultQty: 1,
    visualHint: "Content list, editor, publishing",
  },
  {
    id: "product-catalog",
    name: "Product / Service Catalog",
    category: "Commerce",
    description:
      "Quản lý danh sách sản phẩm hoặc dịch vụ, danh mục, hình ảnh, trạng thái và thông tin chi tiết.",
    suggestedPrice: 24000000,
    defaultQty: 1,
    visualHint: "Catalog grid, detail page, filters",
  },
  {
    id: "cart-checkout",
    name: "Cart & Checkout Flow",
    category: "Commerce",
    description:
      "Giỏ hàng, quy trình checkout, thông tin giao hàng và xác nhận đơn hàng.",
    suggestedPrice: 26000000,
    defaultQty: 1,
    visualHint: "Cart, checkout steps, order summary",
  },
  {
    id: "payment-integration",
    name: "Payment Gateway Integration",
    category: "Commerce",
    description:
      "Tích hợp cổng thanh toán hoặc chuyển khoản, xử lý trạng thái thanh toán và thông báo kết quả.",
    suggestedPrice: 18000000,
    defaultQty: 1,
    visualHint: "Payment status, webhooks, receipt",
  },
  {
    id: "api-integration",
    name: "Third-party API Integration",
    category: "Integration",
    description:
      "Kết nối hệ thống với API bên thứ ba như CRM, ERP, shipping, payment, email hoặc analytics.",
    suggestedPrice: 16000000,
    defaultQty: 1,
    visualHint: "API flow, sync, mapping",
  },
  {
    id: "notification",
    name: "Email / Push Notification",
    category: "Integration",
    description:
      "Thiết lập email, push notification hoặc thông báo nội bộ theo các sự kiện quan trọng.",
    suggestedPrice: 12000000,
    defaultQty: 1,
    visualHint: "Templates, triggers, delivery",
  },
  {
    id: "qa-testing",
    name: "QA Testing & UAT Support",
    category: "Quality",
    description:
      "Kiểm thử chức năng chính, regression checklist, hỗ trợ UAT và xử lý lỗi trước khi go-live.",
    suggestedPrice: 15000000,
    defaultQty: 1,
    visualHint: "Test plan, bug tracking, UAT",
  },
  {
    id: "deployment",
    name: "Deployment & Go-live",
    category: "Quality",
    description:
      "Cấu hình môi trường production, domain, build pipeline và checklist go-live.",
    suggestedPrice: 10000000,
    defaultQty: 1,
    visualHint: "Production, CI/CD, launch checklist",
  },
  {
    id: "maintenance",
    name: "Maintenance & Support",
    category: "Support",
    description:
      "Gói hỗ trợ sau go-live gồm theo dõi vận hành, xử lý lỗi và cải tiến nhỏ theo tháng.",
    suggestedPrice: 12000000,
    defaultQty: 1,
    visualHint: "Monitoring, support, monthly retainer",
  },
];

export const defaultData: AppData = {
  settings: defaultSettings,
  clients: [],
  modules: defaultModules,
  quotes: [],
};
