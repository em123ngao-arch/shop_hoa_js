/**
 * prisma/seed.js - Kịch bản nạp dữ liệu khởi tạo (Seed Data) chuẩn e-commerce cho shopHoa
 * Tương thích: MySQL 8.0, TiDB Cloud Serverless, Local MySQL
 * Chạy: node prisma/seed.js
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'mysql://36iJMwsnLSJJmsy.root:vedxEqS7BNS5s1mP@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/shop_hoa_db?sslaccept=strict'
    }
  }
});

async function main() {
  console.log('🌱 Đang nạp dữ liệu khởi tạo lên CSDL...');

  // 1. TÀI KHOẢN MẪU (Bcrypt Salt 10)
  console.log('--- 1. Nạp tài khoản Admin, Staff, Customer ---');
  const adminPass = await bcrypt.hash('admin123', 10);
  const staffPass = await bcrypt.hash('staff123', 10);
  const custPass = await bcrypt.hash('customer123', 10);

  const defaultUsers = [
    {
      id: 'USR-ADMIN-01',
      email: 'admin@shophoa.example',
      password_hash: adminPass,
      name: 'Quản Trị Viên Trưởng',
      phone: '0908889999',
      role: 'admin',
      avatar_url: './images/favicon-flower.png'
    },
    {
      id: 'USR-STAFF-01',
      email: 'staff@shophoa.example',
      password_hash: staffPass,
      name: 'Thu Ngân Tiệm Hoa',
      phone: '0907778888',
      role: 'staff',
      avatar_url: './images/favicon-flower.png'
    },
    {
      id: 'USR-CUST-01',
      email: 'customer@shophoa.example',
      password_hash: custPass,
      name: 'Trần Thị Mai',
      phone: '0912345678',
      role: 'customer',
      avatar_url: './images/favicon-flower.png'
    },
    {
      id: 'USR-CUST-02',
      email: 'nam.le@shophoa.example',
      password_hash: custPass,
      name: 'Lê Hoàng Nam',
      phone: '0933456789',
      role: 'customer',
      avatar_url: './images/favicon-flower.png'
    },
    {
      id: 'USR-CUST-03',
      email: 'giang.pham@shophoa.example',
      password_hash: custPass,
      name: 'Phạm Hương Giang',
      phone: '0988765432',
      role: 'customer',
      avatar_url: './images/favicon-flower.png'
    }
  ];

  for (const u of defaultUsers) {
    await prisma.users.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, phone: u.phone },
      create: u
    });
  }

  // 2. DANH MỤC HOA
  console.log('--- 2. Nạp Danh mục hoa ---');
  const defaultCategories = [
    { id: '1', name: 'Hoa Kẽm Nhung', slug: 'hoa-kem-nhung', description: 'Các mẫu hoa được tạo tác thủ công 100% từ sợi kẽm nhung cao cấp mềm mại, bền đẹp vĩnh cửu theo thời gian.' },
    { id: '2', name: 'Bó Hoa Sinh Nhật', slug: 'bo-hoa-sinh-nhat', description: 'Bó hoa phối sắc hiện đại kèm giấy gói Hàn Quốc và nơ lụa cao cấp, thích hợp làm quà tặng sinh nhật bất ngờ.' },
    { id: '3', name: 'Giỏ & Hộp Hoa', slug: 'gio-hop-hoa', description: 'Thiết kế giỏ mây tre đan hoặc hộp quà trái tim sang trọng, phù hợp để bàn tiếp khách và tặng kỷ niệm.' },
    { id: '4', name: 'Hoa Để Bàn Mini', slug: 'hoa-de-ban-mini', description: 'Chậu hoa kẽm nhung nhỏ gọn tinh tế, tô điểm bàn làm việc, góc học tập và không gian sống nhẹ nhàng.' },
    { id: '5', name: 'Hoa Khai Trương', slug: 'hoa-khai-truong', description: 'Giỏ hoa và lẵng hoa tone đỏ vàng may mắn, chúc mừng đối tác đại cát đại lợi, hồng phát tài lộc.' }
  ];

  for (const c of defaultCategories) {
    await prisma.categories.upsert({
      where: { id: c.id },
      update: { name: c.name, slug: c.slug, description: c.description },
      create: c
    });
  }

  // 3. SẢN PHẨM MẪU (17 MẪU HOA CHUẨN)
  console.log('--- 3. Nạp 17 Mẫu hoa thủ công ---');
  const defaultProducts = [
    { id: 'PROD-001', category_id: '1', name: 'Bó Hoa Kẽm Nhung Tulip Pastel', price: 350000, was_price: 420000, cost_price: 150000, stock: 25, image_url: './images/350k.jpg', description: 'Bó hoa tulip kẽm nhung phối các sắc pastel dịu nhẹ ngọt ngào, uốn nắn thủ công tỉ mỉ từng cánh hoa.', badge: 'Bán chạy', is_active: true },
    { id: 'PROD-002', category_id: '2', name: 'Bó Hoa Hồng Kẽm Nhung Sunset', price: 420000, was_price: 420000, cost_price: 180000, stock: 18, image_url: './images/350.png', description: 'Sự kết hợp tinh tế giữa hoa hồng kẽm nhung sắc cam hoàng hôn rực rỡ và giấy gói cao cấp chuẩn phong cách Hàn Quốc.', badge: 'Hot', is_active: true },
    { id: 'PROD-003', category_id: '1', name: 'Bó Hoa Kẽm Nhung Hướng Dương Rực Rỡ', price: 390000, was_price: 450000, cost_price: 160000, stock: 15, image_url: './images/399.png', description: 'Những đóa hướng dương kẽm nhung vàng ươm tràn đầy sức sống và niềm tin, món quà khích lệ tinh thần tuyệt vời.', badge: '-13%', is_active: true },
    { id: 'PROD-004', category_id: '2', name: 'Bó Hoa Tulip Hồng Phấn Mộng Mơ', price: 450000, was_price: 511000, cost_price: 200000, stock: 19, image_url: './images/399.png', description: 'Bó hoa phối sắc hồng phấn ngọt ngào và tinh khôi, gói giấy lụa Hàn Quốc cao cấp kèm nơ ruy băng sang trọng.', badge: '-12%', is_active: true },
    { id: 'PROD-005', category_id: '3', name: 'Giỏ Hoa Kẽm Nhung Garden Sunshine', price: 480000, was_price: 480000, cost_price: 220000, stock: 12, image_url: './images/402.png', description: 'Giỏ hoa kẽm nhung kết hợp hoa cúc họa mi, hướng dương và hoa hồng, mang trọn vẹn khu vườn ánh nắng ban mai.', badge: 'Mới', is_active: true },
    { id: 'PROD-006', category_id: '1', name: 'Bó Hoa Baby Kẽm Nhung Xanh Biển', price: 600000, was_price: 600000, cost_price: 250000, stock: 10, image_url: './images/baby-xanh-bien.png', description: 'Bó hoa baby kẽm nhung sắc xanh biển đại dương thanh khiết, uốn nắn thủ công cầu kỳ.', badge: 'Handmade', is_active: true },
    { id: 'PROD-007', category_id: '2', name: 'Bó Hoa Kẽm Nhung Cúc Họa Mi Tinh Khôi', price: 500000, was_price: 500000, cost_price: 210000, stock: 16, image_url: './images/450k.png', description: 'Cúc họa mi kẽm nhung trắng tinh khôi kết hợp nơ xanh trang nhã, biểu tượng của sự thuần khiết.', badge: 'Bán chạy', is_active: true },
    { id: 'PROD-008', category_id: '1', name: 'Bó Hoa Kẽm Nhung Lavender Tím Huế', price: 425000, was_price: 500000, cost_price: 180000, stock: 22, image_url: './images/499.jpg', description: 'Những nhành hoa oải hương tím biếc uốn nắn mềm mại, bền màu vĩnh viễn, lưu giữ kỷ niệm tình yêu son sắt.', badge: '-15%', is_active: true },
    { id: 'PROD-009', category_id: '3', name: 'Hộp Hoa Kẽm Nhung Trái Tim Sweet Love', price: 490000, was_price: 550000, cost_price: 220000, stock: 14, image_url: './images/500k.png', description: 'Hộp hoa trái tim phối hồng và đỏ nồng nàn, món quà tỏ tình lãng mạn bền lâu.', badge: 'Hot', is_active: true },
    { id: 'PROD-010', category_id: '2', name: 'Bó Hoa Kẽm Nhung Đa Sắc Cầu Vồng', price: 580000, was_price: 580000, cost_price: 240000, stock: 15, image_url: './images/501.png', description: 'Bó hoa phối 7 sắc màu rực rỡ từ kẽm nhung loại 1, tràn đầy năng lượng tươi vui.', badge: 'Sáng tạo', is_active: true },
    { id: 'PROD-011', category_id: '4', name: 'Bình Hoa Kẽm Nhung Để Bàn Thanh Lịch', price: 600000, was_price: 600000, cost_price: 260000, stock: 8, image_url: './images/503.png', description: 'Bình hoa để bàn sang trọng với các đóa hồng, tulip và mẫu đơn kẽm nhung kết hợp.', badge: 'Trang trí', is_active: true },
    { id: 'PROD-012', category_id: '2', name: 'Bó Hoa Kẽm Nhung Hoàng Gia Queen', price: 650000, was_price: 765000, cost_price: 290000, stock: 10, image_url: './images/550k.png', description: 'Bó hoa cỡ lớn phối hoa hồng nhung đỏ và vương miện hoàng gia quý phái.', badge: '-15%', is_active: true },
    { id: 'PROD-013', category_id: '5', name: 'Giỏ Hoa Kẽm Nhung Khai Trương Tài Lộc', price: 720000, was_price: 720000, cost_price: 320000, stock: 8, image_url: './images/600k.png', description: 'Giỏ hoa kẽm nhung tông vàng kim rực rỡ, đại cát đại lợi chúc mừng khai trương hồng phát.', badge: 'May mắn', is_active: true },
    { id: 'PROD-014', category_id: '1', name: 'Bó Hoa Nghệ Thuật Bloom Of Spring', price: 520000, was_price: 520000, cost_price: 230000, stock: 12, image_url: './images/bloom-of-spring.png', description: 'Tác phẩm hoa kẽm nhung độc bản với phong cách phối màu nghệ thuật đương đại.', badge: 'Độc bản', is_active: true },
    { id: 'PROD-015', category_id: '4', name: 'Chậu Hoa Kẽm Nhung Mini Để Bàn Xinh', price: 320000, was_price: 320000, cost_price: 130000, stock: 20, image_url: './images/300.png', description: 'Chậu hoa kẽm nhung nhỏ nhắn để bàn học, bàn làm việc tạo điểm nhấn thư thái.', badge: 'Mini', is_active: true },
    { id: 'PROD-016', category_id: '1', name: 'Bó Hoa Cẩm Tú Cầu Kẽm Nhung Xanh Biển', price: 460000, was_price: 460000, cost_price: 190000, stock: 14, image_url: './images/baby-xanh-bien.png', description: 'Đóa cẩm tú cầu kết từ hàng trăm cánh hoa kẽm nhung xanh lam dịu mát, biểu tượng lòng biết ơn.', badge: 'Handmade', is_active: true },
    { id: 'PROD-017', category_id: '2', name: 'Bó Hoa Mẫu Đơn Kẽm Nhung Quý Phái', price: 590000, was_price: 650000, cost_price: 240000, stock: 11, image_url: './images/500k.png', description: 'Mẫu đơn kẽm nhung cánh xếp bồng bềnh sang trọng, tone hồng kem quý phái.', badge: '-9%', is_active: true }
  ];

  for (const p of defaultProducts) {
    const original_price = p.was_price || p.price;
    await prisma.products.upsert({
      where: { id: p.id },
      update: {
        name: p.name,
        price: p.price,
        original_price,
        cost_price: p.cost_price,
        stock: p.stock,
        image_url: p.image_url,
        badge: p.badge,
        is_active: p.is_active
      },
      create: {
        id: p.id,
        category_id: p.category_id,
        name: p.name,
        price: p.price,
        original_price,
        cost_price: p.cost_price,
        stock: p.stock,
        image_url: p.image_url,
        description: p.description,
        badge: p.badge,
        is_active: p.is_active
      }
    });
  }

  // 4. PHỤ KIỆN (ADD-ONS)
  console.log('--- 4. Nạp Phụ kiện tặng kèm (Add-ons) ---');
  const defaultAddons = [
    { id: 'ADDON-LED', name: 'Đèn LED đom đóm lung linh', price: 15000, is_active: true },
    { id: 'ADDON-CARD', name: 'Thiệp viết tay thủ công cao cấp', price: 10000, is_active: true },
    { id: 'ADDON-BAG', name: 'Túi kính trong suốt đựng hoa sang trọng', price: 20000, is_active: true }
  ];

  for (const a of defaultAddons) {
    await prisma.addons.upsert({
      where: { id: a.id },
      update: { name: a.name, price: a.price, is_active: a.is_active },
      create: a
    });
  }

  // 5. MÃ GIẢM GIÁ (VOUCHERS)
  console.log('--- 5. Nạp Mã giảm giá (Vouchers) ---');
  const defaultVouchers = [
    { id: 'VOUCHER-01', code: 'HOAXUAN20', name: 'Giảm 20% Đón Xuân', discount_type: 'percent', discount_value: 20, min_order: 300000, max_discount: 100000, scope: 'all', usage_limit: 100, used_count: 0, is_active: true },
    { id: 'VOUCHER-02', code: 'FREESHIP', name: 'Giảm 30.000đ Phí Vận Chuyển', discount_type: 'fixed', discount_value: 30000, min_order: 250000, max_discount: 30000, scope: 'all', usage_limit: 200, used_count: 0, is_active: true },
    { id: 'VOUCHER-03', code: 'WELCOME10', name: 'Ưu đãi khách hàng mới', discount_type: 'percent', discount_value: 10, min_order: 200000, max_discount: 50000, scope: 'all', usage_limit: 500, used_count: 0, is_active: true },
    { id: 'VOUCHER-04', code: 'GIAM50K', name: 'Ưu Đãi Đặc Biệt Giảm 50K', discount_type: 'fixed', discount_value: 50000, min_order: 400000, max_discount: 50000, scope: 'all', usage_limit: 150, used_count: 0, is_active: true }
  ];

  for (const v of defaultVouchers) {
    await prisma.vouchers.upsert({
      where: { code: v.code },
      update: { name: v.name, discount_type: v.discount_type, discount_value: v.discount_value, min_order: v.min_order, max_discount: v.max_discount, is_active: v.is_active },
      create: v
    });
  }

  // 6. BANNERS
  console.log('--- 6. Nạp Banner chủ đề trang chủ ---');
  const defaultBanners = [
    { id: '1', title: 'Khai Xuân Đắc Lộc <br>Vạn Sự Cát Tường 2027', image_url: './images/Lunar New Year Blossom Bouquet.png', link_url: '#products', display_order: 1, is_active: true, tag: '🧧 Khai Xuân Đắc Lộc 2027', description: 'Hộp hoa kẽm nhung phối sắc đỏ vàng may mắn, hoa mai phú quý cùng mèo thần tài chiêu tài đón lộc.', theme: 'tet', cta_text: 'Sắm Hoa Đón Tết 2027' },
    { id: '2', title: 'Trao Gửi Yêu Thương <br>Bền Đẹp Theo Năm Tháng', image_url: './images/350.png', link_url: '#products', display_order: 2, is_active: true, tag: '🌿 Tinh Hoa Nghệ Thuật Handmade', description: 'Từng cành hoa được uốn nắn thủ công 100% từ sợi kẽm nhung cao cấp mềm mịn, giữ trọn vẻ tươi tắn vĩnh cửu.', theme: 'default', cta_text: 'Khám Phá Các Mẫu Hoa' },
    { id: '3', title: 'Khai Trương Hồng Phát <br>Tài Lộc Thịnh Vượng', image_url: './images/300.png', link_url: '#products', display_order: 3, is_active: true, tag: '⚡ Siêu Ưu Đãi Giờ Vàng', description: 'Bó hoa tulip phối sắc cam vàng rực rỡ tượng trưng cho nhiệt huyết và thịnh vượng, món quà tinh tế chúc phát tài.', theme: 'sale', cta_text: 'Săn Ưu Đãi Ngay' },
    { id: '4', title: 'Gửi Trọn Tình Yêu <br>Hoa Nhung Vĩnh Cửu', image_url: './images/500k.png', link_url: '#products', display_order: 4, is_active: true, tag: '💖 Mùa Yêu Thương Lãng Mạn', description: 'Bó hoa hồng kẽm nhung cánh sen ngọt ngào cùng thiệp chúc mừng viết tay thủ công.', theme: 'valentine', cta_text: 'Khám Phá Mẫu Hoa Tình Yêu' }
  ];

  for (const b of defaultBanners) {
    await prisma.banners.upsert({
      where: { id: b.id },
      update: { title: b.title, image_url: b.image_url, is_active: b.is_active, theme: b.theme, cta_text: b.cta_text },
      create: b
    });
  }

  // 7. ĐÁNH GIÁ MẪU
  console.log('--- 7. Nạp Đánh giá mẫu có sao & phản hồi ---');
  const sampleReviews = [
    { id: 'REV-001', product_id: 'PROD-001', user_id: 'USR-CUST-01', rating: 5, comment: 'Bó hoa tulip màu pastel ở ngoài đẹp hơn trong ảnh rất nhiều! Cánh hoa mềm mịn, bạn gái mình rất thích.', is_hidden: false },
    { id: 'REV-002', product_id: 'PROD-002', user_id: 'USR-CUST-02', rating: 4, comment: 'Hoa uốn tỉ mỉ, màu cam hoàng hôn ấm áp. Shop đóng gói cẩn thận có bọc bóng khí.', is_hidden: false },
    { id: 'REV-003', product_id: 'PROD-004', user_id: 'USR-CUST-03', rating: 5, comment: 'Tone hồng phấn rất xinh xắn, nơ ruy băng chỉn chu. Mình sẽ ủng hộ shop tiếp vào các dịp tới!', is_hidden: false },
    { id: 'REV-004', product_id: 'PROD-003', user_id: 'USR-CUST-01', rating: 4, comment: 'Hoa làm đẹp và tươi sáng, nghệ nhân làm kĩ càng.', is_hidden: false }
  ];

  for (const r of sampleReviews) {
    await prisma.reviews.upsert({
      where: { id: r.id },
      update: { rating: r.rating, comment: r.comment },
      create: r
    });
  }

  console.log('\n🎉 HOÀN TẤT NẠP DỮ LIỆU SEED LÊN CSDL CLOUD!');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('❌ Lỗi khi nạp seed:', e);
  await prisma.$disconnect();
  process.exit(1);
});
