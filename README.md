# GoldFinger Island

Trò chơi team-building 2D: xây đủ 10 công trình, phòng thủ đảo và dùng tên lửa để cản đối thủ. Người hoàn thành đầu tiên thắng vòng; bảng xếp hạng được giữ lại khi vòng mới bắt đầu.

## Phòng trận

- Mỗi phòng có mã riêng và link mời dạng `/?room=ABC123`.
- Tối đa 12 người chơi trong một phòng.
- Người tạo chọn tham gia tự do hoặc cần phê duyệt.
- Sau khi vào phòng, mọi người có quyền gameplay ngang nhau.
- Một tài khoản có thể tham gia nhiều phòng và chuyển phòng tại Trung tâm.
- Mỗi phòng có các vòng reset riêng và bảng xếp hạng được giữ vĩnh viễn trong phòng đó.

## Chạy local

Yêu cầu Node.js 20 trở lên.

```bash
npm install
npm run dev
```

Mở `http://localhost:3000`. Nếu chưa có biến môi trường, game tự chạy ở chế độ `DEMO` và lưu trạng thái bằng `localStorage`.

## Luật đã cân bằng

| Công trình | Số lượng | Giá mỗi căn | Thời gian |
| --- | ---: | ---: | ---: |
| Lều thám hiểm | 2 | 30 | 60 giây |
| Nhà gỗ | 2 | 55 | 90 giây |
| Biệt thự | 2 | 85 | 120 giây |
| Khu nghỉ dưỡng | 2 | 125 | 180 giây |
| Lâu đài | 2 | 155 | 240 giây |

- Bắt đầu với 1.000 coin; tổng chi phí xây là 900 coin.
- Tối đa 2 công trình đang xây.
- Tên lửa giá 5 coin, bay 3 phút, tối đa 2 quả đang bay.
- Bắn trúng nhận 10 coin.
- Lá chắn từng nhà giá 2 coin; lá chắn toàn đảo giá 15 coin; hiệu lực 5 phút.
- Điểm danh mỗi ngày nhận 20 coin.
- Nhấn `F` để bật/tắt toàn màn hình.

## Kết nối Supabase

1. Tạo project tại Supabase.
2. Mở SQL Editor và chạy lần lượt [migration nền tảng](./supabase/migrations/20260717000000_schema.sql), [migration multiplayer](./supabase/migrations/20260717000100_multiplayer.sql), và [migration phòng trận](./supabase/migrations/20260717000200_game_rooms.sql).
3. Trong Authentication > Providers > Email, bật Email và tắt `Confirm email` để người chơi dùng tài khoản ngay sau khi đăng ký.
4. Thêm URL của local và Vercel vào Authentication > URL Configuration.
5. Tạo `.env.local` từ `.env.example`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
```

Ứng dụng ưu tiên Publishable key mới và vẫn hỗ trợ `NEXT_PUBLIC_SUPABASE_ANON_KEY` cũ. Nút `Đăng nhập` có hai chế độ đăng nhập/đăng ký bằng email và mật khẩu; Google OAuth được để dành cho giai đoạn sau.

`multiplayer.sql` chuyển gameplay sang các RPC chạy phía server: trình duyệt không được tự sửa coin, thời gian xây, mục tiêu tên lửa hoặc kết quả vòng. Supabase Realtime phát thay đổi công trình, radar, sự kiện và bảng xếp hạng đến các người chơi đang online. Radar không trả về `target_slot`.

## GitHub và Vercel

```bash
git add .
git commit -m "Build GoldFinger Island MVP"
git branch -M main
git remote add origin https://github.com/YOUR_ACCOUNT/goldfinger-island.git
git push -u origin main
```

Trên Vercel:

1. Import repository GitHub.
2. Framework Preset: Next.js.
3. Thêm hai biến môi trường Supabase giống `.env.local`.
4. Deploy.

Vercel tự nhận `npm run build`. Không đưa `.env.local` hoặc service-role key lên GitHub.

## Kiểm thử

```bash
npm run build
```

Game cung cấp hai hook dành cho kiểm thử:

- `window.render_game_to_text()` trả trạng thái ngắn gọn dưới dạng JSON.
- `window.advanceTime(ms)` tăng thời gian game có kiểm soát.
