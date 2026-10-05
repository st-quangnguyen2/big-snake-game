# Big Snake 3D 🐍

Game rắn săn mồi 3D chạy trên trình duyệt, **điều khiển bằng chuyển động đầu và cổ qua webcam**.
Rắn chỉ bò về phía trước (không lùi được); người chơi xoay đầu để rẽ trái/phải, cúi đầu nhẹ để tăng tốc
và ngẩng đầu lên để nhìn toàn cảnh.
Con mồi là trái cây và động vật nhỏ. Mỗi ván dài 2–5 phút tuỳ chọn, kỷ lục được lưu trên máy (localStorage).

## Chạy game

Cần Node.js 18+.

```bash
npm install
npm run dev
```

Mở địa chỉ Vite in ra (mặc định `http://localhost:5173`).

- `/` — game
- `/models.html` — thư viện model 3D (xem, xoay, xem hoạt ảnh từng đối tượng)

## Deploy

Game là một trang web tĩnh, không cần server. `npm run build` tạo thư mục `dist/` (~23 MB, phần lớn là runtime
WASM của MediaPipe), có thể đưa lên bất kỳ dịch vụ static hosting nào có **HTTPS** (bắt buộc để dùng camera):

| Dịch vụ | Cài đặt |
| --- | --- |
| Netlify / Vercel / Cloudflare Pages | Build command `npm run build`, output `dist`, Node 18+ |
| Netlify Drop (không cần Git) | Kéo thả thư mục `dist/` vào https://app.netlify.com/drop |
| GitHub Pages | Có sẵn workflow `.github/workflows/deploy.yml` (xem bên dưới) |

Lưu ý: kỷ lục lưu trong localStorage nên gắn với từng trình duyệt và từng tên miền.

### GitHub Pages

1. Tạo repository trên GitHub rồi đẩy code lên nhánh `main`:
   `git remote add origin https://github.com/<user>/<repo>.git` và `git push -u origin main`.
2. Vào **Settings → Pages → Build and deployment → Source** chọn **GitHub Actions** (chỉ làm một lần).
3. Mỗi lần push lên `main`, workflow tự `npm ci` → `npm run build` → đăng `dist/`.
   Theo dõi ở tab **Actions**; game chạy tại `https://<user>.github.io/<repo>/`
   và thư viện model tại `https://<user>.github.io/<repo>/models.html`.

Vite dùng `base: './'` (đường dẫn tương đối) nên chạy đúng trong thư mục con `/<repo>/` mà không cần cấu hình thêm.

## Model nhận diện đầu: MediaPipe Face Landmarker

Game dùng [MediaPipe Face Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js)
(`@mediapipe/tasks-vision`) vì:

- Chạy hoàn toàn trong trình duyệt (WebAssembly + GPU), ~10–15 ms/khung hình, không cần server.
- Trả về **ma trận biến đổi khuôn mặt 3D** (`facialTransformationMatrixes`), từ đó tính trực tiếp
  góc xoay đầu (yaw), cúi/ngẩng (pitch) và nghiêng (roll) — chính xác hơn tự ước lượng từ landmark 2D.
- Model nhỏ (~3.6 MB, float16), tối ưu cho camera selfie.

Xử lý góc đầu (`src/headTracker.js`):

1. Lấy phần quay (quaternion) của ma trận biến đổi.
2. **Hiệu chỉnh**: người chơi nhìn thẳng 1 giây, lấy trung bình làm tư thế "thẳng"; mọi góc tính tương đối so với tư thế này.
3. Lọc nhiễu bằng **One Euro filter** (mượt khi giữ yên, nhạy khi chuyển động nhanh).
4. `src/input.js` đổi góc thành lệnh lái: vùng chết 3.5°, góc tối đa theo độ nhạy (12°–34°), cúi đầu > 12° để tăng tốc,
   ngẩng đầu 6°–18° để nâng camera dần lên góc nhìn toàn cảnh.

Mọi xử lý hình ảnh diễn ra trên máy người chơi; không có hình ảnh nào được gửi đi.
WASM runtime được copy từ `node_modules` sang `public/mediapipe/wasm` khi `npm install`/`dev`/`build`.
File model được tải từ Google Cloud Storage ở lần chạy đầu; muốn tự host, đặt file vào `public/models/` và chạy với
`VITE_FACE_MODEL_URL=./models/face_landmarker.task`.

## Luật chơi

| Con mồi | Điểm | Dài thêm |
| --- | --- | --- |
| 🍎 Táo / 🍊 Cam / 🍌 Chuối / 🍓 Dâu | 10–15 | +1 |
| 🍇 Nho | 20 | +2 |
| 🍉 Dưa hấu | 30 | +3 |
| ⭐ Táo vàng (xuất hiện ngẫu nhiên, 10 giây) | 100 | +2 |
| 🐥 Gà con / 🐭 Chuột / 🐸 Ếch / 🐰 Thỏ (bỏ chạy khi rắn tới gần) | 35–70 | +2–3 |

- Ăn liên tiếp trong 2.6 giây để tăng combo: ×1.5, ×2 … tối đa ×3.
- Bộ đếm dưới đồng hồ ghi số chuột / gà con / ếch / thỏ / trái cây đã ăn; khi bắt được thú, biểu tượng của nó
  bay vào ô đếm (kèm pháo sáng và tiếng "ting"); màn kết thúc ván có bảng tổng kết theo từng loại.
- Đâm vào hàng rào hoặc cắn phải thân mình: −10 điểm, rắn ngắn lại 20%, mất combo, được miễn va chạm 2 giây.
  Ván **luôn kéo dài đủ thời gian đã chọn**.
- Thanh tăng tốc cạn sẽ phải hồi lại 30% mới dùng tiếp.
- Địa hình: lên dốc chậm lại, xuống dốc nhanh hơn; vũng bùn làm chậm 40%; tảng đá, gốc cây và thân 4 cây to
  là vật cản (tán cây tự mờ khi rắn ở bên dưới); cỏ cao rẽ ra quanh rắn, thú và trái cây rồi dựng lại sau đuôi;
  bụi quả mọng tách ra khi rắn bò xuyên qua.
- Mất khuôn mặt khỏi camera quá 1.5 giây → game tự tạm dừng, tự chơi tiếp khi thấy lại.
- Khi tạm dừng có nút **⚙️ Cài đặt** mở lại toàn bộ menu cài đặt mà không mất ván; bấm "Tiếp tục chơi" để đếm
  ngược 3‑2‑1 rồi chơi tiếp (thời gian chơi mới chỉ áp dụng từ ván sau).

Điều khiển dự phòng bằng bàn phím: `←/→` hoặc `A/D` để lái, `Space` để tăng tốc, giữ `↓`/`S` để nhìn xa,
`C` đổi góc nhìn (Gần / Xa / Trên cao / Thứ nhất), `L` khoá đúng khung hình camera đang hiển thị
(kể cả khi đang ngẩng đầu nhìn toàn cảnh; sau đó ngẩng đầu / `↓` / `C` không đổi góc nữa — cũng bật được bằng nút 🔒
trên màn hình hoặc trong menu), `M` tắt/bật tiếng, `Esc`/`P` để tạm dừng.

## Tuỳ biến (menu → 🎨 Tuỳ biến)

- **Rắn**: 9 màu da với hoa văn riêng (sọc, kim cương, chấm bi, vằn hổ, cầu vồng) và 8 kiểu đầu
  (Cổ điển, Dễ thương, Ngầu, Nhà vua, Tiệc tùng, Rồng, Nơ xinh, Mèo con), có khung xem trước 3D.
- **Sân chơi**: Đồng cỏ, Mùa thu, Mùa đông, Sa mạc, Xứ kẹo (`src/themes.js` — mỗi theme là bảng đổi màu).
- **Sáng / Tối / Theo máy**: chế độ tối đổi giao diện sang tông tối và sân thành ban đêm (trăng, sao, đom đóm).
- **Cỏ**: số phiến mỗi bụi (16–32), độ cao, độ rậm, kích thước cụm và độ đa dạng (đa dạng cao → cỏ mọc thành
  mảng to nhỏ ngẫu nhiên). Phiến cỏ và hoa uốn cong quanh gốc khi bị đè (giữ nguyên chiều dài), mỗi phiến
  cứng/lệch hướng khác nhau. Lực đẩy được tính sẵn thành một "bản đồ lực" 128×128 mỗi khung hình nên cỏ dày
  vẫn nhẹ (~2 ms/khung hình ở mức tối đa trên máy thử).
- **Hoa**: 9 loại (`src/models/flowers.js`) mọc thành khóm, mỗi bông cao thấp và nghiêng khác nhau.

## Âm thanh

Toàn bộ âm thanh được tổng hợp bằng Web Audio (`src/audio.js`, `src/music.js`), không dùng file ngoài:
nhạc nền riêng cho menu và khi chơi (tăng nhịp ở 20 giây cuối), tiếng ăn mồi theo combo, tiếng kêu riêng của
từng con vật khi bỏ chạy, tăng tốc, lội bùn, va chạm, táo vàng xuất hiện, đếm ngược… Âm lượng nhạc nền và
hiệu ứng chỉnh riêng ở menu hoặc màn tạm dừng, được lưu lại cùng các cài đặt khác.

## Cấu trúc mã

```
index.html, src/main.js     Giao diện: menu, hiệu chỉnh, HUD, tạm dừng, kết thúc, bảng kỷ lục
src/game.js                 Scene Three.js, luật chơi, camera bám đuôi, bản đồ nhỏ
src/snake.js                Rắn: di chuyển theo vệt, va chạm, lớn lên / ngắn lại, hoạt ảnh
src/prey.js                 Trái cây lơ lửng và AI động vật (đi lang thang, bỏ chạy, né tường)
src/world.js                Đấu trường đồi núi, vật cản, bùn, cây to, bụi quả, cỏ tương tác, theme và đêm
src/themes.js               Bảng màu các theme sân và ánh sáng ban đêm
src/preview.js              Khung xem trước rắn 3D trong menu
src/headTracker.js          Webcam + MediaPipe Face Landmarker → góc đầu đã lọc
src/input.js                Bàn phím và ánh xạ góc đầu → lệnh lái
src/storage.js              Cài đặt và kỷ lục (localStorage, top 20 mỗi mức thời gian)
src/audio.js, music.js      Hiệu ứng âm thanh, kênh âm lượng và nhạc nền (bộ sequencer nhỏ)
src/particles.js            Hiệu ứng hạt
src/models/                 Toàn bộ model 3D dựng bằng code (không dùng file ngoài)
src/viewer/                 Trang thư viện model
```
