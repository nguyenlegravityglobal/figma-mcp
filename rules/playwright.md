# Figma to data.ts Style Rule

## Trigger
- Khi người dùng gõ lệnh `start data`
- Nếu chưa có Figma URL (desktop & mobile), AI phải yêu cầu người dùng cung cấp
- Nếu chưa có file `data.ts`, AI phải yêu cầu người dùng cung cấp hoặc tạo file này trước khi sinh styles

## Mục đích
Tự động trích xuất các thuộc tính typography và color từ Figma JSON (MCP) để sinh object styles cho file `data.ts`.

## Phạm vi áp dụng
- Mapping tất cả selector text tìm được trong Figma JSON (ví dụ: h1, h2, h3, p, span, .class, #id, ...)
- Chỉ lấy các thuộc tính:
  - Typography: `fontFamily`, `fontWeight`, `fontSize`, `lineHeight`, `letterSpacing`, `textTransform`
  - Color: `color` (luôn xuất ra chuẩn rgb, giữa các số phải có dấu phẩy và 1 space, ví dụ: `rgb(255, 255, 255)`)
- Không lấy padding, margin, gap, background, border, ...

## Quy trình
1. Kiểm tra sự tồn tại của file `data.ts`
   - Nếu chưa có, yêu cầu người dùng cung cấp hoặc tạo file mẫu rỗng
2. Nhận Figma JSON (MCP) cho từng breakpoint (desktop, mobile)
3. Trích xuất các thuộc tính typography và color cho tất cả selector text tìm được
   - Color luôn convert sang chuẩn rgb, giữa các số phải có dấu phẩy và 1 space (vd: rgb(255, 255, 255))
4. Mapping giá trị vào object styles:

```ts
styles: {
  desktop: {
    h1: { ... },
    h2: { ... },
    p: { ... },
    ".my-class": { ... },
    // ... tất cả selector text khác
  },
  mobile: {
    h1: { ... },
    h2: { ... },
    p: { ... },
    ".my-class": { ... },
    // ...
  }
}
```

5. Nếu selector không có thuộc tính nào, để `{}`
6. Nếu thiếu giá trị, bỏ qua trường đó
7. Nếu trong Figma JSON có element text mà không có selector tương ứng trong data.ts, phải alert (thông báo) cho người dùng biết để bổ sung hoặc xác nhận mapping

## Lưu ý
- Tất cả selector liệt kê đều phải có style (không để thiếu selector nào trong output)
- Tên class selector chỉ mang ý nghĩa tượng trưng, không nhất thiết đúng với nội dung thực tế trong Figma
- Nếu selector là class (vd: .icon__arrow) nhưng thực tế có thể là text, hãy tìm element phù hợp nhất trong Figma JSON để mapping style (ưu tiên element có text hoặc gần nghĩa nhất)
- Chỉ focus vào typography và color
- Color luôn phải là chuẩn rgba, giữa các số phải có dấu phẩy và 1 space (vd: rgb(255, 255, 255))
- Không tự động thêm các trường khác ngoài rule này
- Output là object styles để copy vào file `data.ts`

## Ví dụ sử dụng
- Nhận Figma JSON từ MCP cho desktop và mobile
- Sinh object styles như trên cho tất cả selector text
- Copy vào file `data.ts`