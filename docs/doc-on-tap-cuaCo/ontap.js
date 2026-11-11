/**
 * -khai báo biến:
 * + var: không khuyến khích
 * + let: khuyến khích sử dụng, phạm vi block let tenbien = "giá trị";
 * + const: khai báo hằng số, không thể gán lại, phạm vi block
 * -Kiểu dữ liệu:
 * + String
 * + Number
 * + Boolean
 * + Object
 * + Array
 * + null
 * + undefined
 * - Toán tử:
 * + optional chaining (?.)
 * + nullish coalescing (??)
 * + Toán tử so sánh (==, ===, !=, !==, >, <, >=, <=) 10=="10", 10==="10"
 * + Toán tử logic (&&, ||, !)
 * - Ép kiểu:
 *  +Number(<giá trị cần ép kiểu>)
 *  + String(value)
 *  + Boolean(value)
 * + parseInt(value)
 * + parseFloat(value)
 * - Cấu trúc điều khiển:
 *  + if...else
 *  + switch
 *  + for
 *  + while
 *  + do...while
 *  + for...of
 *  +for...in
 * - Hàm:
 *  + Arrow function (hàm mũi tên): (tham số) => { return/* thân hàm }
 *    ++ Nếu không có tham số thì ()=>{ return giá trị; }
 *    ++ Nếu chỉ có một biểu thức trả về thì có thể viết gọn: (tham số) => biểu_thức;
 *    ++ Nếu chỉ có 1 tham số thì có thể bỏ dấu ngoặc: tham_so => biểu_thức;
 *  + Hàm thường: function tenHam(tham_so) { /* thân hàm }, tự nhớ
 *  + Hàm ẩn danh (Anonymous function): function(tham_so) { /* thân hàm }
 * - Mảng:cú pháp let/const tenmang=[giá_trị1, giá_trị2, ...];
 * + Truy cập phần tử: tenmang[index]
 * + Thêm phần tử vào mảng: tenmang.push(giá_trị);
 * + Xóa phần tử cuối cùng: tenmang.pop();
 * + Xóa phần tử đầu tiên: tenmang.shift();
 * + Thêm phần tử vào đầu mảng: tenmang.unshift(giá_trị);
 * + Xóa phần tử tại vị trí bất kỳ: tenmang.splice(vị_trí, số_lượng);
 * + Thêm phần tử tại vị trí bất kỳ: tenmang.splice(vị_trí, 0, giá_trị);
 * - Hàm đặc biệt:
 * + mang.forEach(hàm): không làm thay đổi giá trị của mảng
 * + mang.forEach((thamso)=>{return giá_trị;})
 * +mang.forEach(function(thamso){ return giá_trị; })
 * +mang.find(hàm): trả về phần tử đầu tiên thỏa mãn điều kiện trong hàm,
 *  nếu không có thì trả về undefined
 * +mang.filter(hàm): trả về một mảng gồm các phần tử thỏa mãn điều kiện trong hàm,
 *  nếu không có thì trả về mảng rỗng
 * +mang.map(hàm): trả về một mảng mới với các phần tử được biến đổi theo hàm,
 *  nếu mảng gốc rỗng thì trả về mảng rỗng, nhưng không làm thay đổi mảng gốc
 * +mang.reduce((giatrihientai, phantu) => { return giatrihientai; }, giatribandau): 
 * trả về một giá trị duy nhất sau khi thực hiện hàm trên tất cả các phần tử của mảng,
 *  giatribandau là giá trị khởi tạo
 * +mang.include(giá trị): trả về true nếu mảng chứa giá trị, ngược lại trả về false
 * +mang.some(hàm): trả về true nếu có ít nhất một phần tử thỏa mãn điều kiện trong hàm, ngược lại trả về false
 * +mang.every(hàm): trả về true nếu tất cả các phần tử thỏa mãn điều kiện trong hàm, ngược lại trả về false
 * +mang.sort((a, b) => a - b): sắp xếp mảng theo thứ tự tăng dần, có thể tùy chỉnh hàm so sánh
 * +mang.reverse(): đảo ngược thứ tự các phần tử trong mảng
 * +mang.concat(mangkhac): trả về một mảng mới là kết quả nối mảng hiện tại với mảng khác, không làm thay đổi mảng gốc
 * -Object:
 * + Cú pháp: let/const tenObject = { key1: value1, key2: value2, ... };
 * + Truy cập thuộc tính: tenObject.key hoặc tenObject["key"]
 * + Thêm/ sửa thuộc tính: tenObject.key = value hoặc tenObject["key"] = value
 * + bên trong object có thể chứa các object khác, mảng, hàm, giá trị nguyên thủy
 *  ví dụ: let obj={ thuoctinh1: "giatri1", thuoctinh2: "giatri2" ,ham()}
 * - Destructuring:phân rã mảng và object
 * + Destructuring mảng: let [a, b] = [1, 2];
 * + Destructuring object: let {key1, key2} = {key1: "value1", key2: "value2"};
 * ví dụ: let [c,d] = [3,4];
 * - Spread và rest: sao chép, gộp mảng, tách tham số
 * + Spread mảng: let newArr = [...oldArr];
 * + Spread object: let newObj = {...oldObj};
 * + Rest tham số: function func(...args) { }
 * -Dom: mối liên hệ giữa html và js
 * + Truy cập phần tử: getElementById("id") hoặc querySelector("#selector")=> trả về phẩn tử
 * + Truy cập phần tử: getElementsByClassName("class") hoặc querySelector(".class") => trả về 1 collection
 * + Truy cập tất cả phần tử: getElementsByTagName("tag") hoặc querySelectorAll("selector") =>Trả về 1 collection, trả về NodeList
 * + Thay đổi nội dung: 
 *    ++ thanhphan.textConent="giá trị"
 *    ++ thanhphan.innerHTML="giá trị"=> được quyền sử dụng thẻ html
 *    ++thanhphan.innerText="giá trị" => chỉ thay đổi nội dung văn bản, không được quyền sử dụng thẻ html
 * + thay đổi thuộc tính: thanhphan.setAttribute("tenthuoc", "giatri") => thay đổi giá trị thuộc tính
 * +thay đổi css: thanhphan.style.property = "giatri" => thay đổi kiểu dáng của phần tử, ví dụ: thanhphan.style.color = "red"
 * + thêm phần tử: 
 *    ++ let newElement = document.createElement("tag");
 *    ++ parentElement.appendChild(newElement); => thêm phần tử vào cuối parentElement
 *    ++ parentElement.insertBefore(newElement, referenceElement); => thêm phần tử trước referenceElement trong parentElement
 * + xóa: remove()
 * + xự kiện: onclick(hàm),onchange(hàm),onsubmit(hàm)
 *   +thanhphan.addEventListener(sự kiện, hàm)
 * - Bất đồng bộ: Asyn/await luôn có try...catch
 * - Lấy dữ liệu API dùng axios: get(URL), put(URL/giatri),post(URL/giatri), delete(URL/giatri)
 * - nếu ko dùng axios thì có thể fetch(URL)
 *   + ví dụ: fetch(URL).then(response => response.json()).then(data => console.log(data));
 */
let sanpham = {
    ten: "Ao thun",
    gia: 200000,
    size: ["S", "M", "L"],
    mota: "Ao thun cotton",
    khuyenmai() {
        return this.gia * 0.9;
    }
};
let sanpham1={...sanpham,hinh:"hinh1.jpg"};