# HTML vs Design Comparison Tools

Tài liệu này hướng dẫn sử dụng các tool MCP mới để so sánh HTML với design image và so sánh images.

## 🔄 Complete Development Workflow

### Step 1: Get Figma Design
```javascript
{
  "tool": "figmaDesign",
  "arguments": {
    "figmaUrl": "https://www.figma.com/file/abc123/my-design"
  }
}
```
**Output**: Design data + automatic next steps guidance

### Step 2: Build HTML/CSS
Follow the provided guidelines focusing on:
- 🔍 SPACING: Exact margins, padding, gaps
- 🔤 FONT FAMILY: Precise font declarations  
- 📦 CONTAINER: Accurate width, max-width, positioning
- 📐 CONTENT WIDTH: Main content area dimensions
- 🖼️ IMAGE SIZING: Correct image dimensions

### Step 3: Verify Implementation (Auto-suggested)
```javascript
{
  "tool": "compareHtmlWithDesignAdvanced",
  "arguments": {
    "htmlFilePath": "./your-html-file.html",
    "designImagePath": "./design-image.png"
  }
}
```

### Step 4: Fix Issues & Re-verify
- Follow detailed recommendations
- Focus on priority issues first
- Re-run comparison until pixel-perfect

## Cài đặt Dependencies

Trước khi sử dụng, cần cài đặt các dependencies:

```bash
npm install playwright pixelmatch pngjs sharp
npx playwright install chromium
```

## Tools Available

### 1. `compareHtmlDesign` - Basic Comparison

Tool cơ bản để so sánh HTML với design image.

**Parameters:**
- `htmlFilePath` (string): Đường dẫn đến file HTML
- `designImagePath` (string): Đường dẫn đến file image design

**Example:**
```javascript
// Sử dụng trong MCP
{
  "tool": "compareHtmlDesign",
  "arguments": {
    "htmlFilePath": "./index.html",
    "designImagePath": "./design.png"
  }
}
```

### 2. `compareHtmlDesignAdvanced` - Advanced Comparison

Tool nâng cao với nhiều tùy chọn cấu hình và **pixel-level image comparison** với **layout-focused analysis**.

**Parameters:**
- `htmlFilePath` (string): Đường dẫn đến file HTML
- `designImagePath` (string): Đường dẫn đến file image design
- `viewportWidth` (number, optional): Chiều rộng viewport (default: auto từ design image)
- `viewportHeight` (number, optional): Chiều cao viewport (default: auto từ design image)
- `selector` (string, optional): CSS selector cho element cần screenshot (default: 'body')
- `fullPage` (boolean, optional): Chụp toàn bộ trang (default: true)
- `waitForSelector` (string, optional): CSS selector để đợi trước khi chụp
- `delay` (number, optional): Thời gian delay trước khi chụp (ms, default: 1000)

**🏗️ Layout-Focused Features:**
- **Tự động ignore color differences** để focus vào structure
- **Grayscale conversion** để loại bỏ ảnh hưởng của màu sắc
- **Higher threshold** để ignore minor pixel differences
- **Layout-specific recommendations** về spacing, typography, positioning
- **🔍 SPACING PRIORITY**: Focus chính vào margin, padding, gap properties
- **🔤 FONT FAMILY ACCURACY**: Đảm bảo font-family chính xác 100%
- **📦 CONTAINER PRECISION**: Container width, padding, positioning pixel-perfect
- **📐 AUTO VIEWPORT**: Tự động set viewport theo kích thước design image

**Example:**
```javascript
// Viewport sẽ tự động match với design image dimensions
{
  "tool": "compareHtmlDesignAdvanced",
  "arguments": {
    "htmlFilePath": "./index.html",
    "designImagePath": "./design.png"
    // viewport sẽ tự động = design image size
  }
}

// Hoặc override viewport manually nếu cần
{
  "tool": "compareHtmlDesignAdvanced",
  "arguments": {
    "htmlFilePath": "./index.html",
    "designImagePath": "./design.png",
    "viewportWidth": 1920,
    "viewportHeight": 1080
  }
}
```

### 3. `compareImages` - Standalone Image Comparison (NEW!)

Tool để so sánh 2 images bất kỳ với nhau với **layout-focused options**.

**Parameters:**
- `image1Path` (string): Đường dẫn đến image thứ nhất
- `image2Path` (string): Đường dẫn đến image thứ hai  
- `outputDiffPath` (string, optional): Đường dẫn để lưu diff image
- `layoutFocused` (boolean, optional): Focus vào layout changes only (default: false)
- `ignoreColors` (boolean, optional): Convert to grayscale để ignore color differences (default: false)
- `threshold` (number, optional): Comparison threshold 0-1, higher = less sensitive (default: 0.1)

**Example:**
```javascript
// So sánh layout-focused (ignore colors)
{
  "tool": "compareImages",
  "arguments": {
    "image1Path": "./screenshot1.png",
    "image2Path": "./screenshot2.png",
    "layoutFocused": true,
    "threshold": 0.2
  }
}
```

### 4. `analyzeDifferences` - Detailed Difference Analysis (NEW!)

Tool để phân tích chi tiết sự khác biệt từ diff image và đưa ra gợi ý fix cụ thể.

**Parameters:**
- `screenshotPath` (string): Đường dẫn đến HTML screenshot
- `designPath` (string): Đường dẫn đến design image
- `diffImagePath` (string): Đường dẫn đến diff image (từ comparison trước đó)

**🔍 Analysis Features:**
- **Issue Detection**: Tự động detect các loại issues (alignment, spacing, typography)
- **Area Distribution**: Phân tích vị trí của differences (top/middle/bottom, left/center/right)
- **Severity Classification**: Major, Moderate, Minor issues
- **Specific Fix Suggestions**: Gợi ý CSS properties cụ thể cần check
- **Priority Ordering**: Sắp xếp fixes theo độ ưu tiên

**Example:**
```javascript
{
  "tool": "analyzeDifferences",
  "arguments": {
    "screenshotPath": "./html-screenshot.png",
    "designPath": "./design.png",
    "diffImagePath": "./diff-result.png"
  }
}
```

## Features

### 🔍 Tính năng chính:
- **Browser Automation**: Sử dụng Playwright để mở HTML trong Chrome
- **Screenshot Capture**: Chụp ảnh màn hình của HTML rendered
- **Pixel-Level Comparison**: So sánh từng pixel giữa 2 images
- **Diff Image Generation**: Tạo ảnh diff highlight sự khác biệt
- **Similarity Scoring**: Tính toán % tương đồng giữa images
- **Flexible Configuration**: Nhiều tùy chọn cấu hình
- **Detailed Analysis**: Phân tích chi tiết về metrics và kích thước

### 📊 Thông tin được cung cấp:
- Screenshot của HTML rendered
- Design image gốc
- **Diff image với highlights màu đỏ cho sự khác biệt**
- **Similarity percentage (0-100%)**
- **Số pixel khác biệt**
- Page metrics (dimensions, scroll size, title)
- File sizes và timestamps
- Recommendations cho việc so sánh

### 🎯 Image Comparison Algorithm:
- **Automatic Resizing**: Tự động resize images về cùng kích thước
- **Pixel Matching**: So sánh từng pixel với threshold configurable
- **Diff Visualization**: Màu đỏ = khác biệt, trắng = giống nhau
- **Smart Scoring**: Tính toán similarity dựa trên số pixel khác biệt

### 🏗️ Layout-Focused Analysis (NEW!):
- **Structure Priority**: Focus vào spacing, typography, width/height thay vì colors
- **Grayscale Conversion**: Tự động convert sang grayscale để ignore color differences
- **Higher Threshold**: Sử dụng threshold cao hơn để ignore minor antialiasing differences
- **Layout Recommendations**: Cung cấp suggestions cụ thể về layout issues

**Layout Elements được focus (Priority Order):**
- 🔍 **SPACING (TOP PRIORITY)**: Margin, padding, gap, line-height, letter-spacing
- 🔤 **FONT FAMILY (CRITICAL)**: Font-family declarations, font-weight, font-loading
- 📦 **CONTAINER (ESSENTIAL)**: Width, max-width, padding, positioning, breakpoints
- 📐 **CONTENT WIDTH (COMMONLY MISSED)**: Main content area width, content wrapper max-width
- 🖼️ **IMAGE SIZING (OFTEN WRONG)**: Image dimensions, aspect-ratio, object-fit properties
- ✅ **Element Positioning**: Left/right/top/bottom positioning
- ✅ **Layout Structure**: Flexbox, grid layout differences
- ❌ **Colors**: Ignored in layout-focused mode
- ❌ **Shadows & Effects**: Ignored to focus on structure
- ❌ **Minor Antialiasing**: Ignored to reduce noise

### 🚨 Issue Detection & Analysis:

**Detected Issue Types:**
1. **Alignment Issues**:
   - Horizontal alignment differences (left/right positioning)
   - Vertical alignment problems
   - Text alignment inconsistencies

2. **Layout Issues**:
   - Header/navigation positioning problems
   - Footer layout differences
   - Main content area misalignment

3. **Spacing Issues**:
   - Margin/padding inconsistencies
   - Line-height differences
   - Letter-spacing variations

4. **Typography Issues**:
   - Font rendering differences
   - Text size variations
   - Font-weight inconsistencies

**Severity Levels:**
- 🔴 **MAJOR**: Significant structural differences (>5% of image)
- 🟡 **MODERATE**: Noticeable differences (2-5% of image)
- 🟢 **MINOR**: Small differences (<2% of image)

**Fix Suggestions Include:**
- Specific CSS properties to check
- Common causes of the detected issues
- Priority order for fixes
- Next steps for resolution

### 💡 Use Cases:
- **QA Testing**: Kiểm tra HTML implementation so với design
- **Visual Regression**: Phát hiện thay đổi không mong muốn
- **Design Review**: So sánh kết quả với mockup
- **Responsive Testing**: Kiểm tra ở các viewport khác nhau
- **A/B Testing**: So sánh 2 versions của cùng 1 page
- **Cross-browser Testing**: So sánh screenshots từ các browsers khác nhau

## Output

### Advanced HTML Comparison trả về:
1. **Text Report**: Thông tin chi tiết về quá trình so sánh
2. **HTML Screenshot**: Ảnh chụp màn hình của HTML
3. **Design Image**: Ảnh design gốc để so sánh
4. **Diff Image**: Ảnh highlight sự khác biệt (màu đỏ)
5. **Similarity Score**: Phần trăm tương đồng
6. **Pixel Analysis**: Số pixel khác biệt vs tổng số pixel

### Standalone Image Comparison trả về:
1. **Comparison Report**: Kết quả so sánh chi tiết
2. **Diff Image**: Ảnh highlight sự khác biệt
3. **Similarity Analysis**: Đánh giá mức độ tương đồng

## Similarity Scoring

- **95-100%**: ✅ Excellent match! Images are nearly identical
- **85-94%**: ✅ Good match with minor differences  
- **70-84%**: ⚠️ Moderate differences detected
- **0-69%**: ❌ Significant differences found

## Error Handling

Tools sẽ xử lý các lỗi phổ biến:
- File không tồn tại
- Lỗi browser automation
- Lỗi network hoặc loading
- Lỗi permission

## Tips

1. **Đảm bảo HTML file hoàn chỉnh**: Include tất cả CSS và assets cần thiết
2. **Sử dụng absolute paths**: Để tránh lỗi đường dẫn
3. **Kiểm tra viewport size**: Đảm bảo phù hợp với design
4. **Sử dụng waitForSelector**: Cho các trang có loading time
5. **Adjust delay**: Nếu trang cần thời gian render

## Best Practices

### 🔍 SPACING Accuracy:
1. **Use browser dev tools** để measure exact pixel values
2. **Check all margin/padding** properties systematically
3. **Verify line-height** - often causes vertical spacing issues
4. **Test gap properties** in flexbox/grid layouts
5. **Letter-spacing và word-spacing** affect text layout significantly

### 🔤 FONT FAMILY Precision:
1. **Exact font-family names** - case sensitive và spelling critical
2. **Font-weight values** must match design (400, 500, 600, etc.)
3. **Web font loading** - ensure fonts load before screenshot
4. **Fallback fonts** should be properly configured
5. **Font-display: swap** để avoid invisible text during font load

### 📦 CONTAINER Accuracy:
1. **Container width/max-width** must match design breakpoints exactly
2. **Container padding** affects all child element positioning
3. **Box-sizing: border-box** vs content-box affects calculations
4. **Responsive behavior** - test multiple viewport sizes
5. **Container positioning** (relative, absolute, fixed) affects layout flow

### 📐 CONTENT WIDTH Precision (COMMONLY MISSED):
1. **Main content area width** - measure against design specifications exactly
2. **Content wrapper max-width** - often incorrectly set or missing
3. **Content padding/margin** - affects actual usable content width
4. **Responsive content width** - check at all design breakpoints
5. **Content centering** - verify margin: auto or flexbox centering

### 🖼️ IMAGE SIZING Accuracy (OFTEN WRONG):
1. **Exact image dimensions** - width and height must match design
2. **Aspect ratio preservation** - use aspect-ratio CSS property
3. **Object-fit properties** - cover, contain, fill based on design intent
4. **Image container sizing** - wrapper dimensions affect image display
5. **Responsive images** - srcset and sizes for different viewports
6. **Layout shift prevention** - set dimensions before image loads

## Troubleshooting

### Spacing Issues:
- Use `* { outline: 1px solid red; }` để visualize all elements
- Check computed styles in browser dev tools
- Verify CSS reset/normalize is applied consistently

### Font Issues:
- Check Network tab để ensure fonts load successfully
- Test with `font-display: block` để force font loading
- Verify font files are accessible and correct format

### Container Issues:
- Check parent container constraints
- Verify CSS Grid/Flexbox container properties
- Test responsive behavior at exact design breakpoints

### Playwright không hoạt động:

### ⚠️ Commonly Overlooked Issues:

**📐 Content Width Problems:**
- Main content container width không match design
- Content wrapper max-width sai specifications
- Content padding ảnh hưởng đến actual content width
- Responsive breakpoints không đúng design

**🖼️ Image Sizing Issues:**
- Image width/height không chính xác
- Aspect ratio bị distorted
- Object-fit properties missing hoặc sai
- Image container dimensions không đúng
- Layout shifts do image loading
