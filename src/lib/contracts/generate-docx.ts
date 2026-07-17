"use client";

import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  BorderStyle,
} from "docx";
import { saveAs } from "file-saver";
import { calculateQuoteTotals, formatVnd } from "@/lib/money";
import { LEGAL_DISCLAIMER, legalClauseLibrary } from "./legal-library";
import type { Client, CompanySettings, Quote } from "@/lib/types";

function p(text: string, opts?: { bold?: boolean; center?: boolean; size?: number }) {
  return new Paragraph({
    alignment: opts?.center ? AlignmentType.CENTER : AlignmentType.BOTH,
    spacing: { after: 120 },
    children: [
      new TextRun({
        text,
        bold: opts?.bold,
        size: opts?.size || 22,
        font: "Times New Roman",
      }),
    ],
  });
}

function heading(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, size: 24, font: "Times New Roman" })],
  });
}

function cell(text: string, width: number, opts?: { bold?: boolean; center?: boolean }) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    children: [
      new Paragraph({
        alignment: opts?.center ? AlignmentType.CENTER : AlignmentType.LEFT,
        children: [new TextRun({ text, bold: opts?.bold, size: 18, font: "Times New Roman" })],
      }),
    ],
  });
}

function buildContractNumber(settings: CompanySettings, quote: Quote) {
  if (quote.contractNumber.trim()) return quote.contractNumber;
  const year = new Date().getFullYear().toString().slice(-2);
  const seq = quote.publicId.slice(-4).toUpperCase();
  return `${seq}${year}/${settings.contractNumberPrefix}`;
}

export async function exportContractDocx(settings: CompanySettings, quote: Quote, client: Client | null) {
  const totals = calculateQuoteTotals(quote);
  const contractNo = buildContractNumber(settings, quote);
  const today = new Date();
  const day = today.getDate();
  const month = today.getMonth() + 1;
  const year = today.getFullYear();
  const clientName = client?.companyName || "……………………………………";
  const clientTax = client?.taxCode || "………………";
  const clientAddress = client?.address || "……………………………………";
  const clientRep = client?.contactName || "……………………";
  const clientTitle = client?.representativeTitle || "……………………";

  const deliverableRows =
    quote.deliverables.length > 0
      ? quote.deliverables.map(
          (d, i) =>
            new TableRow({
              children: [
                cell(String(i + 1), 600, { center: true }),
                cell(d.name, 3500),
                cell(d.priority, 900, { center: true }),
                cell(String(d.effortDays ?? ""), 900, { center: true }),
                cell(d.notes || d.description.slice(0, 80), 3100),
              ],
            }),
        )
      : quote.items.map(
          (item, i) =>
            new TableRow({
              children: [
                cell(String(i + 1), 600, { center: true }),
                cell(item.name, 3500),
                cell("Cao", 900, { center: true }),
                cell("1", 900, { center: true }),
                cell(item.description.slice(0, 80), 3100),
              ],
            }),
        );

  const feeRows = quote.items.map(
    (item, i) =>
      new TableRow({
        children: [
          cell(String(i + 1), 600, { center: true }),
          cell(item.name, 4000),
          cell("Gói", 800, { center: true }),
          cell(String(item.qty), 800, { center: true }),
          cell(formatVnd(item.unitPrice), 1600),
          cell(formatVnd(item.qty * item.unitPrice), 1800),
        ],
      }),
  );

  const paymentRows = quote.paymentMilestones.map(
    (m) =>
      new TableRow({
        children: [
          cell(m.label, 1200),
          cell(m.description, 3200),
          cell(m.trigger, 2200),
          cell(`${m.percent}%`, 1000, { center: true }),
          cell(formatVnd((totals.grandTotal * m.percent) / 100), 2000),
        ],
      }),
  );

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, bottom: 720, left: 900, right: 900 },
          },
        },
        children: [
          p("HỢP ĐỒNG DỊCH VỤ", { bold: true, center: true, size: 32 }),
          p("PHÁT TRIỂN PHẦN MỀM", { bold: true, center: true, size: 32 }),
          p(`Số: ${contractNo}`, { center: true }),
          p(`Thành phố Hồ Chí Minh, ngày ${day} tháng ${month} năm ${year}`, { center: true }),
          p(""),
          p(
            `Hôm nay, ngày ${day} tháng ${month} năm ${year} tại Thành phố Hồ Chí Minh, chúng tôi gồm:`,
          ),
          p(settings.companyName, { bold: true }),
          p(`Địa chỉ: ${settings.address}`),
          p(`Mã số thuế: ${settings.taxCode}`),
          p(
            `Người đại diện theo pháp luật: ${settings.legalRepresentative} – Chức vụ: ${settings.legalRepresentativeTitle}`,
          ),
          p('Sau đây gọi tắt là "Công ty"'),
          p("Và"),
          p(clientName, { bold: true }),
          p(`Địa chỉ: ${clientAddress}`),
          p(`Mã số thuế: ${clientTax}`),
          p(`Người đại diện theo pháp luật: ${clientRep} – Chức vụ: ${clientTitle}`),
          p(
            client?.authorizationDoc
              ? `Theo giấy ủy quyền: ${client.authorizationDoc}`
              : "Theo giấy ủy quyền số………. ký ngày……….",
          ),
          p('Sau đây gọi tắt là "Khách hàng"'),
          p(
            'Bên Công ty và Khách hàng, sau đây gọi chung là "Các Bên". Các Bên chấp thuận chịu sự ràng buộc bởi các điều khoản sau.',
          ),
          p(""),
          p(LEGAL_DISCLAIMER, { bold: true }),
          heading("Điều 1. Định nghĩa"),
          p(
            `1.1. "Dịch vụ" là dịch vụ xác định yêu cầu, phân tích thiết kế, phát triển và bàn giao sản phẩm phần mềm cho ${clientName}, bao gồm các hạng mục tại Phụ lục.`,
          ),
          p(
            '1.2. "Tài nguyên" là tài liệu phát triển và tài sản (mã nguồn và chương trình) được tạo trong quá trình phát triển cho Khách hàng.',
          ),
          p(
            '1.3. "Mã nguồn chương trình và phần mềm" là phần mềm, tài liệu hoặc tài nguyên được phát triển theo Hợp đồng này bởi Công ty.',
          ),
          heading("Điều 2. Phạm vi Dịch vụ và tính toàn vẹn của Hợp đồng"),
          p(
            "2.1. Hợp đồng này thay thế mọi văn bản, cam kết hoặc hiểu biết trước đây liên quan đến nội dung tại đây. Mọi sửa đổi chỉ có hiệu lực khi lập thành văn bản và có chữ ký đại diện có thẩm quyền.",
          ),
          p(
            "2.2. Công ty cam kết cung cấp Dịch vụ theo Phụ lục đính kèm. Khách hàng thanh toán phí dịch vụ theo tiến độ quy định.",
          ),
          heading("Điều 3. Sản phẩm phần mềm và quy trình sản xuất"),
          p(
            '3.1. Sản phẩm thuộc nhóm "Phần mềm quản trị, quản trị từ xa" theo danh mục sản phẩm phần mềm của Bộ TT&TT (Thông tư 20/2021/TT-BTTTT).',
          ),
          p(
            "3.2. Quy trình gồm: xác định yêu cầu; phân tích và thiết kế; lập trình; kiểm thử; hoàn thiện/đóng gói; cài đặt, chuyển giao, đào tạo, bảo trì/bảo hành.",
          ),
          heading("Điều 4. Quyền và nghĩa vụ của Công ty"),
          p(
            "4.1. Quyền: từ chối yêu cầu ngoài phạm vi đã duyệt; yêu cầu thông tin kịp thời; nhận phí đúng hạn; showcase tổng quát (không vi phạm bảo mật); đơn phương chấm dứt theo HĐ/pháp luật.",
          ),
          p(
            "4.2. Nghĩa vụ: thực hiện chuyên môn; báo cáo tiến độ; khắc phục sai sót giai đoạn thử nghiệm; bàn giao tài liệu và hướng dẫn; không gây tổn hại uy tín Khách hàng; không đại diện Khách hàng với bên thứ ba nếu không được ủy quyền.",
          ),
          heading("Điều 5. Quyền và nghĩa vụ của Khách hàng"),
          p(
            "5.1. Sau khi hoàn thành nghĩa vụ tài chính, Khách hàng có quyền sở hữu thành phần tùy chỉnh. IP nền tảng thuộc Công ty. Khách hàng được kiểm tra, phản hồi và nghiệm thu theo Phụ lục.",
          ),
          p(
            "5.2. Nghĩa vụ: cung cấp thông tin/tài liệu chính xác; thanh toán đúng hạn; phản hồi xét duyệt kịp thời; bảo mật thông tin nghiệp vụ của Công ty.",
          ),
          heading("Điều 6. Phí Dịch vụ"),
          p(
            `6.1. Tổng giá trị hợp đồng (theo báo giá hiện tại): ${formatVnd(totals.grandTotal)} (đã gồm chiết khấu/VAT nếu áp dụng trên báo giá). Chi tiết tại Phụ lục.`,
          ),
          p(
            "6.2. Thay đổi phạm vi có thể dẫn tới thay đổi tiến độ/phí và phải lập Phụ lục sửa đổi, bổ sung.",
          ),
          heading("Điều 7. Hóa đơn và thanh toán"),
          p(
            "7.1. Công ty lập hóa đơn theo từng đợt thanh toán tại Phụ lục.",
          ),
          p(
            "7.2. Khách hàng chuyển khoản trong vòng 05 (năm) ngày làm việc kể từ khi nhận Đề nghị thanh toán và/hoặc Hóa đơn GTGT.",
          ),
          ...(settings.bankAccountNumber
            ? [
                p(
                  `Thông tin tài khoản: ${settings.bankAccountName} – STK ${settings.bankAccountNumber} – ${settings.bankName}`,
                ),
              ]
            : []),
          heading("Điều 8. Bảo mật thông tin"),
          p(
            "8.1–8.3. Các Bên cam kết bảo mật thông tin bí mật; ngoại trừ tiết lộ được phép, theo pháp luật, hoặc thông tin đã công khai không do tiết lộ trái phép.",
          ),
          heading("Điều 9. Quyền sở hữu trí tuệ"),
          p(
            "9.1. Quyền đối với thành phần tùy chỉnh chuyển giao sau khi Khách hàng thanh toán đủ.",
          ),
          p(
            "9.2. Công ty bảo lưu IP nền tảng (core, framework, thư viện dùng chung, know-how).",
          ),
          p(
            "9.3. IP nền tảng tích hợp được cấp quyền sử dụng không độc quyền, không chuyển nhượng rời, chỉ để vận hành sản phẩm.",
          ),
          p(
            "9.4–9.6. Cải tiến do Khách hàng chi trả thuộc Khách hàng (trừ phương pháp phổ quát). Công ty cam kết không xâm phạm IP bên thứ ba. Trách nhiệm sau bàn giao theo thỏa thuận và pháp luật.",
          ),
          heading("Điều 10. Thời hạn và chấm dứt"),
          p(
            "10.1. Hợp đồng chấm dứt khi hoàn thành nghĩa vụ, theo thỏa thuận, hoặc theo thông báo/vi phạm theo quy định. Khách hàng thanh toán phần đã thực hiện; Công ty bàn giao tương ứng mức độ hoàn thiện.",
          ),
          heading("Điều 11. Phạt vi phạm và bồi thường thiệt hại"),
          p(
            "11.1. Phạt vi phạm mẫu: 8% giá trị phần nghĩa vụ bị vi phạm (không vượt mức tối đa pháp luật).",
          ),
          p(
            "11.2. Bồi thường thiệt hại thực tế, trực tiếp, có căn cứ. Lãi chậm thanh toán mẫu: 0,05%/ngày hoặc mức tối đa pháp luật (lấy mức thấp hơn).",
          ),
          heading("Điều 12. Điều khoản khác"),
          p(
            "12.1. Hợp đồng điều chỉnh theo pháp luật Việt Nam. Tranh chấp ưu tiên thương lượng; sau 60 ngày có thể đưa ra Tòa án nhân dân có thẩm quyền tại Việt Nam.",
          ),
          p(
            "12.2. Bất khả kháng: thông báo kịp thời; kéo dài quá 30 ngày có thể yêu cầu thanh lý.",
          ),
          p(
            "12.3. Hợp đồng lập thành 04 (bốn) bản có giá trị như nhau, mỗi Bên giữ 02 (hai) bản.",
          ),
          p(""),
          p("ĐẠI DIỆN CÁC BÊN", { bold: true, center: true }),
          p(""),
          p(`${settings.companyName}`, { bold: true }),
          p(`${settings.legalRepresentative}`),
          p(`${settings.legalRepresentativeTitle}`),
          p(""),
          p(`${clientName}`, { bold: true }),
          p(`${clientRep}`),
          p(`${clientTitle}`),
          p(""),
          heading("PHỤ LỤC 1 – PHẠM VI, LỊCH TRÌNH VÀ NỘI DUNG CÔNG VIỆC"),
          p(`(Kèm theo Hợp đồng số ${contractNo})`),
          p(`Dự án: ${quote.title}`),
          p(`Loại dự án: ${quote.projectType}`),
          p(quote.projectOverview || "Phạm vi chi tiết theo bảng chức năng và biểu phí dưới đây."),
          heading("Điều 1. Các chức năng bàn giao"),
          new Table({
            width: { size: 9000, type: WidthType.DXA },
            rows: [
              new TableRow({
                children: [
                  cell("STT", 600, { bold: true, center: true }),
                  cell("Chức năng / Module", 3500, { bold: true }),
                  cell("Ưu tiên", 900, { bold: true, center: true }),
                  cell("Ngày", 900, { bold: true, center: true }),
                  cell("Ghi chú", 3100, { bold: true }),
                ],
              }),
              ...deliverableRows,
            ],
          }),
          heading("Điều 2. Biểu phí dịch vụ (theo modules)"),
          new Table({
            width: { size: 9600, type: WidthType.DXA },
            rows: [
              new TableRow({
                children: [
                  cell("STT", 600, { bold: true, center: true }),
                  cell("Hạng mục", 4000, { bold: true }),
                  cell("Đơn vị", 800, { bold: true, center: true }),
                  cell("SL", 800, { bold: true, center: true }),
                  cell("Đơn giá", 1600, { bold: true }),
                  cell("Thành tiền", 1800, { bold: true }),
                ],
              }),
              ...feeRows,
              new TableRow({
                children: [
                  cell("", 600),
                  cell("TỔNG GIÁ TRỊ HỢP ĐỒNG", 6400, { bold: true }),
                  cell(formatVnd(totals.grandTotal), 1800, { bold: true }),
                ],
              }),
            ],
          }),
          heading("Điều 3. Tiến độ thanh toán"),
          new Table({
            width: { size: 9600, type: WidthType.DXA },
            rows: [
              new TableRow({
                children: [
                  cell("Đợt", 1200, { bold: true }),
                  cell("Mô tả", 3200, { bold: true }),
                  cell("Thời điểm", 2200, { bold: true }),
                  cell("Tỷ lệ", 1000, { bold: true, center: true }),
                  cell("Thành tiền", 2000, { bold: true }),
                ],
              }),
              ...paymentRows,
            ],
          }),
          heading("Điều 4. Công nghệ sử dụng"),
          p(quote.techStack.join(", ") || "Theo thỏa thuận kỹ thuật."),
          heading("Điều 5. Bảo hành và hỗ trợ"),
          p(
            `5.1. Bảo hành miễn phí ${quote.warrantyMonths} tháng kể từ go-live hoặc nghiệm thu (thời điểm nào đến trước).`,
          ),
          p(
            "5.2. Hỗ trợ lỗi kỹ thuật trong phạm vi đã nghiệm thu, cơ chế 8x5 (T2–T6 giờ hành chính).",
          ),
          p(
            "5.3. Không bao gồm nâng cấp tính năng, thay đổi nghiệp vụ, lỗi bên thứ ba hoặc tự ý chỉnh sửa hệ thống.",
          ),
          p(
            `5.4. Sau bảo hành, phí bảo trì định kỳ gợi ý: ${formatVnd(quote.maintenanceFeeMonthly)}/tháng (chưa VAT), trừ khi có thỏa thuận khác.`,
          ),
          p(""),
          heading("Phụ lục tham chiếu – Thư viện điều khoản pháp lý (nội bộ)"),
          ...legalClauseLibrary.flatMap((clause) => [
            p(`${clause.title} (${clause.legalBasis})`, { bold: true }),
            p(clause.body),
          ]),
          p(""),
          p(LEGAL_DISCLAIMER, { bold: true }),
        ],
      },
    ],
  });

  // silence unused BorderStyle if tree-shaken differently
  void BorderStyle;

  const blob = await Packer.toBlob(doc);
  const safeClient = (client?.companyName || "Khach-hang").replace(/[^\w\-]+/g, "_").slice(0, 40);
  const safeTitle = (quote.title || "Hop-dong").replace(/[^\w\-]+/g, "_").slice(0, 40);
  saveAs(blob, `Hop-dong_${safeClient}_${safeTitle}.docx`);
}
