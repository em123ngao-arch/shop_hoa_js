import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  filterCatalogProducts,
  matchProductColor,
  matchFlowerType,
  matchOccasion,
  matchMaterial,
  matchPriceRange,
  removeVietnameseTones
} from '../../public/js/business-rules.js';

const mockProducts = [
  { id: 'PROD-001', category_id: '1', name: 'Bó Hoa Kẽm Nhung Tulip Pastel', price: 350000, description: 'Bó hoa tulip handmade từ sợi kẽm nhung sắc pastel dịu nhẹ' },
  { id: 'PROD-002', category_id: '2', name: 'Bó Hoa Hồng Kẽm Nhung Sunset', price: 420000, description: 'Sắc cam hoàng hôn rực rỡ tượng trưng cho nhiệt huyết' },
  { id: 'PROD-003', category_id: '1', name: 'Bó Hoa Kẽm Nhung Hướng Dương Rực Rỡ', price: 390000, description: 'Hướng dương kẽm nhung vàng ươm tràn đầy niềm tin tri ân thầy cô' },
  { id: 'PROD-004', category_id: '2', name: 'Bó Hoa Tulip Hồng Phấn Mộng Mơ', price: 450000, description: 'Bó hoa tulip phối sắc hồng phấn ngọt ngào' },
  { id: 'PROD-005', category_id: '3', name: 'Giỏ Hoa Kẽm Nhung Garden Sunshine', price: 480000, description: 'Giỏ hoa kết hợp cúc họa mi, hướng dương vàng và hoa hồng' },
  { id: 'PROD-006', category_id: '1', name: 'Bó Hoa Baby Kẽm Nhung Xanh Biển', price: 600000, description: 'Bó hoa baby sắc xanh biển thanh khiết' },
  { id: 'PROD-007', category_id: '2', name: 'Bó Hoa Kẽm Nhung Cúc Họa Mi Tinh Khôi', price: 500000, description: 'Cúc họa mi trắng tinh khôi kết hợp nơ xanh' },
  { id: 'PROD-008', category_id: '1', name: 'Bó Hoa Kẽm Nhung Lavender Tím Huế', price: 425000, description: 'Nhành hoa oải hương tím biếc uốn nắn mềm mại' },
  { id: 'PROD-011', category_id: '4', name: 'Bình Hoa Kẽm Nhung Để Bàn Thanh Lịch', price: 600000, description: 'Bình hoa để bàn sang trọng với các đóa hồng, tulip và hoa ly' },
  { id: 'PROD-MWFTAMC6', category_id: '1', name: 'Cam tulip', price: 5000, description: 'Hoa tulip kẽm nhung sắc cam tươi sáng' }
];

test('removeVietnameseTones chuyển đổi chính xác tiếng Việt có dấu thành không dấu', () => {
  assert.equal(removeVietnameseTones('Hoa Màu Cam Rực Rỡ'), 'hoa mau cam ruc ro');
  assert.equal(removeVietnameseTones('Tri Ân Thầy Cô 20/11'), 'tri an thay co 20/11');
});

test('matchProductColor lọc chính xác tone màu cam', () => {
  const orangeProducts = mockProducts.filter(p => matchProductColor(p, 'cam'));
  assert.ok(orangeProducts.length >= 2, 'Phải tìm thấy ít nhất 2 mẫu hoa tone cam');
  assert.ok(orangeProducts.some(p => p.id === 'PROD-002'), 'Phải chứa Bó Hoa Hồng Sunset');
  assert.ok(orangeProducts.some(p => p.id === 'PROD-MWFTAMC6'), 'Phải chứa Cam tulip');
});

test('matchFlowerType lọc chính xác hoa tulip và hướng dương', () => {
  const tulips = mockProducts.filter(p => matchFlowerType(p, 'tulip'));
  assert.ok(tulips.every(p => p.name.toLowerCase().includes('tulip') || p.description.toLowerCase().includes('tulip')), 'Tất cả phải là tulip');
  assert.equal(tulips.length, 4);

  const sunflowers = mockProducts.filter(p => matchFlowerType(p, 'huong-duong'));
  assert.ok(sunflowers.length >= 2);
});

test('matchOccasion lọc chính xác dịp 20/11 tri ân thầy cô', () => {
  const occasion2011 = mockProducts.filter(p => matchOccasion(p, '20-11'));
  assert.ok(occasion2011.length >= 3, 'Dịp 20/11 phải có hướng dương, bình để bàn, cúc họa mi');
  assert.ok(occasion2011.some(p => p.id === 'PROD-003'));
  assert.ok(occasion2011.some(p => p.id === 'PROD-011'));
});

test('filterCatalogProducts lọc kết hợp đa tiêu chí: màu cam + giá <= 500k', () => {
  const results = filterCatalogProducts(mockProducts, {
    color: 'cam',
    priceRange: '350-500'
  });
  assert.equal(results.length, 1);
  assert.equal(results[0].id, 'PROD-002');
});

test('filterCatalogProducts tìm kiếm không dấu "hoa mau cam" trả về đúng sản phẩm', () => {
  const results = filterCatalogProducts(mockProducts, {
    searchTerm: 'hoa mau cam'
  });
  assert.ok(results.length >= 1);
  assert.ok(results.some(p => p.id === 'PROD-002' || p.id === 'PROD-MWFTAMC6'));
});

test('matchPriceRange lọc chuẩn xác 7 phân khúc giá của hoahandmade.vn', () => {
  assert.ok(matchPriceRange({ price: 20000 }, 'under-50'));
  assert.ok(!matchPriceRange({ price: 60000 }, 'under-50'));

  assert.ok(matchPriceRange({ price: 80000 }, '50-100'));
  assert.ok(matchPriceRange({ price: 150000 }, '100-200'));
  assert.ok(matchPriceRange({ price: 250000 }, '200-300'));
  assert.ok(matchPriceRange({ price: 350000 }, '300-400'));
  assert.ok(matchPriceRange({ price: 450000 }, '400-500'));
  assert.ok(matchPriceRange({ price: 600000 }, 'above-500'));
  assert.ok(!matchPriceRange({ price: 400000 }, 'above-500'));
});

test('matchMaterial lọc đúng chất liệu kẽm nhung, giấy nhún, len', () => {
  const kemNhung = mockProducts.filter(p => matchMaterial(p, 'kem-nhung'));
  assert.equal(kemNhung.length, mockProducts.length, 'Tất cả mẫu hoa mock đều là kẽm nhung');

  const giayNhun = mockProducts.filter(p => matchMaterial(p, 'giay-nhun'));
  assert.equal(giayNhun.length, 0, 'Không có mẫu giấy nhún trong mock');
});

