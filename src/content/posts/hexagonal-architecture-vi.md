---
title: "Hexagonal Architecture (Ports & Adapters): Tài liệu tham khảo toàn diện"
description: "Tài liệu tham khảo toàn diện về Hexagonal Architecture (Kiến trúc lục giác / Ports & Adapters): nguồn gốc, khái niệm cốt lõi về chiều phụ thuộc, và công thức thực tiễn cho backend TypeScript hiện đại."
pubDatetime: 2026-05-31T00:00:00Z
tags:
  - architecture
  - hexagonal-architecture
  - software-design
  - vietnamese
---

## Tóm tắt nhanh (TL;DR)

- **Hexagonal Architecture** (Kiến trúc lục giác — còn được gọi là **Ports & Adapters**, tức Cổng và Bộ chuyển đổi) là một architectural pattern (mẫu kiến trúc phần mềm) được phát minh bởi **Alistair Cockburn**. Nó được vẽ lần đầu năm 1994, được đặt tên trên trang WikiWikiWeb của Ward Cunningham vào khoảng năm 2004, và được hình thức hóa (chính thức hóa) trong bài viết kinh điển của ông đề ngày **4 tháng 9 năm 2005**. Mục tiêu được tuyên bố rõ ràng của nó là _"cho phép một application (ứng dụng) có thể được điều khiển ngang nhau bởi người dùng, bởi các chương trình, bởi automated test (kiểm thử tự động) hay batch script (kịch bản chạy theo lô), đồng thời có thể được phát triển và kiểm thử một cách tách biệt khỏi các thiết bị run-time (lúc chạy) và database (cơ sở dữ liệu) cuối cùng của nó."_ Pattern này giải quyết vấn đề business logic (logic nghiệp vụ) bị quấn chặt vào code của UI (giao diện người dùng), database, và framework (khung lập trình) — một vấn đề kinh niên của traditional layered architecture (kiến trúc phân tầng truyền thống).

- **Chìa khóa khái niệm duy nhất** mà bạn đang hỏi đến chính là sự phân biệt giữa **direction of source-code dependency** (chiều phụ thuộc của mã nguồn — phải trỏ vào trong, hướng về domain core / lõi nghiệp vụ) và **direction of control flow / runtime call** (chiều của luồng điều khiển / lời gọi lúc chạy — thường lại trỏ ra ngoài, ví dụ từ một use case gọi tới database). Hai chiều này được dung hòa nhờ **Dependency Inversion Principle** (Nguyên lý đảo ngược phụ thuộc): phần core _định nghĩa ra_ một interface (giao diện) — gọi là **port** (cổng) — và một adapter (bộ chuyển đổi) ở vòng ngoài sẽ _triển khai_ (implement) nó. Nhờ vậy mũi tên phụ thuộc lúc biên dịch trỏ vào trong, mặc dù mũi tên lời gọi lúc chạy trỏ ra ngoài. Robert C. Martin (tức "Uncle Bob") diễn đạt chính xác điều này: _"chúng ta tận dụng dynamic polymorphism (đa hình động) để tạo ra các source code dependency (phụ thuộc mã nguồn) đi ngược lại với flow of control (luồng điều khiển)."_

- Hexagonal (Cockburn, 2005), **Onion Architecture** (Kiến trúc củ hành — Jeffrey Palermo, 2008), và **Clean Architecture** (Kiến trúc sạch — Robert C. Martin, 2012) là ba anh em trong cùng một gia đình. Cả ba đều đẩy domain (miền nghiệp vụ) vào trung tâm, đưa infrastructure (hạ tầng) ra ngoài, và bắt buộc các source dependency phải trỏ vào trong. Chúng chỉ khác nhau chủ yếu ở mức độ chi tiết của các vòng bên trong và ở thuật ngữ. Với hầu hết các backend (hệ thống phía máy chủ) viết bằng TypeScript ngày nay, công thức thực tiễn là: **(1)** một core gồm domain/use-case không phụ thuộc framework, **(2)** các port (định nghĩa bằng `interface` của TypeScript) được định nghĩa _bởi_ chính core, **(3)** các driving adapter (bộ chuyển đổi điều khiển — như HTTP controller, CLI, message consumer) gọi vào các port, và **(4)** các driven adapter (bộ chuyển đổi bị điều khiển — như repository, HTTP client, queue producer) triển khai các port. Tất cả được nối với nhau lúc khởi động chương trình thông qua dependency injection (tiêm phụ thuộc).

---

## Các phát hiện chính (Key Findings)

1. **Nguồn gốc**: Cockburn đã vẽ sơ đồ lục giác từ sớm nhất là năm **1994** (trong ghi chú khóa học của riêng ông), bàn về nó từ năm 1998, đăng nó lên c2 wiki của Ward Cunningham vào khoảng năm 2004, và xuất bản bài viết kinh điển trên trang của ông vào ngày **4 tháng 9 năm 2005** (HaT Technical Report 2005.02). "Khoảnh khắc lóe sáng" của pattern — nhận ra rằng các mặt (facet) của hình lục giác chính là _port_, còn các đối tượng làm cầu nối chính là _adapter_ — đến với ông vào **tháng 6 năm 2005**. Sau đó ông đề xuất tên gọi thay thế là **"Ports and Adapters"** (mà hiện nay ông coi là chính xác hơn so với "Hexagonal").

2. **Tại sao lại là hình lục giác?** Cockburn nói rõ: _"Hình lục giác không phải là lục giác vì con số sáu quan trọng, mà là để cho những người vẽ sơ đồ có chỗ trống để chèn các port và adapter khi họ cần, không bị bó buộc bởi một bản vẽ phân tầng một chiều."_ Con số 6 là tùy ý; điều quan trọng là hình dạng đó không phải hình chữ nhật và có tính đối xứng.

3. **Hiểu biết cốt lõi** nằm ở _sự bất đối xứng giữa trong và ngoài_ (inside-outside asymmetry), chứ không phải _trái-phải_ (UI đối lại DB). Cockburn nói: _"Sự bất đối xứng cần khai thác không phải là giữa phía bên trái và phía bên phải của application, mà là giữa bên trong và bên ngoài của application. Quy tắc phải tuân theo là: code thuộc về phần bên trong không được rò rỉ ra phần bên ngoài."_

4. **Primary (driving) đối lại secondary (driven)** — tức phía chủ động điều khiển đối lại phía bị điều khiển — là một sự tinh chỉnh _thứ cấp_ mà Cockburn bổ sung về sau trong cùng bài viết đó. Một **primary actor** (tác nhân chủ động) sẽ _điều khiển_ application (như REST controller, CLI, test fixture); một **secondary actor** (tác nhân thụ động) thì _bị application điều khiển_ (như database, message bus, dịch vụ gửi email). Phía driving gọi _vào trong_ hình lục giác; phía driven thì _bị_ hình lục giác gọi ra.

5. **The Dependency Rule** (Quy tắc phụ thuộc) — trung tâm của Clean Architecture và hiện diện một cách ngầm định trong Hexagonal/Onion — phát biểu rằng (Uncle Bob, 2012): _"Source code dependency chỉ có thể trỏ vào trong. Không thứ gì ở vòng trong được biết bất cứ điều gì về thứ gì đó ở vòng ngoài."_

6. **Chiều phụ thuộc đối lại chiều luồng điều khiển** là hai trục độc lập với nhau. Ở phía _driving_ chúng tình cờ trùng nhau (controller → use case, cả lúc biên dịch lẫn lúc chạy). Ở phía _driven_ chúng **ngược nhau**: lúc chạy, use case _gọi_ repository (luồng điều khiển hướng ra ngoài), nhưng lúc biên dịch, repository lại _phụ thuộc vào_ (triển khai) port được định nghĩa trong core (phụ thuộc hướng vào trong). Sự đảo ngược này chính là toàn bộ ý nghĩa của Dependency Inversion Principle trong kiến trúc này.

7. **Onion (Palermo, 2008)** và **Clean (Martin, 2012)** là những bước tiến hóa bổ sung thêm các lớp đồng tâm _bên trong_ lòng hình lục giác (như entities, use cases, application services...). Bản thân Hexagonal không nói gì về cách tổ chức bên trong — điều đó được để dành cho lập trình viên tự quyết (và thường được lấp đầy bằng các building block của DDD).

8. **Kiểm chứng thực tế**: Đội Studio Workflow của Netflix — trong một bài viết của Damir Svrtan và Sergii Makagon có tiêu đề _"Ready for Changes with Hexagonal Architecture"_ (Sẵn sàng cho thay đổi với Kiến trúc lục giác), đăng ngày **10 tháng 3 năm 2020** trên Netflix TechBlog — cho biết pattern này đã cho phép họ di chuyển một read path (đường đọc dữ liệu) từ một API monolith dạng JSON sang một microservice GraphQL chỉ trong **khoảng 2 tiếng đồng hồ**, với một thay đổi vỏn vẹn một dòng. Họ viết: _"Lý do chính giúp chúng tôi làm được nhanh đến vậy là nhờ Hexagonal architecture … Một thay đổi đơn giản chỉ một dòng là tất cả những gì chúng tôi cần để bắt đầu đọc từ một nguồn dữ liệu khác."_

9. **Lời chỉ trích chính** là việc over-engineering (làm quá phức tạp một cách không cần thiết) đối với những application CRUD đơn giản. Phần thưởng của pattern này chỉ thực sự được hiện thực hóa ở **những application có vòng đời dài, với business logic không tầm thường**, tức những hệ thống sống lâu hơn nhiều thế hệ lựa chọn hạ tầng.

---

## Chi tiết (Details)

### 1. Hexagonal Architecture là gì?

**Hexagonal Architecture (kiến trúc lục giác)** là một structural pattern (mẫu cấu trúc) tổ chức một application xoay quanh một **core không phụ thuộc công nghệ** (gọi là "hexagon" / hình lục giác, "domain" / miền nghiệp vụ, hoặc "application" / ứng dụng). Cái core này giao tiếp với thế giới bên ngoài _chỉ thông qua_ những interface được định nghĩa rõ ràng gọi là **port** (cổng). Các công nghệ cụ thể — HTTP, SQL, Kafka, AWS SDK, React, command-line (dòng lệnh) — đều bị giam giữ bên trong các **adapter** (bộ chuyển đổi) cắm vào những port đó.

Định nghĩa về ý đồ của Cockburn, trích nguyên văn từ bài viết năm 2005:

> _"Cho phép một application có thể được điều khiển ngang nhau bởi người dùng, bởi các chương trình, bởi automated test hay batch script, đồng thời có thể được phát triển và kiểm thử một cách tách biệt khỏi các thiết bị run-time và database cuối cùng của nó."_

**Vấn đề mà nó giải quyết** là cái mà Cockburn gọi là _"một trong những con ngáo ộp lớn của các application phần mềm qua nhiều năm: sự xâm nhập của business logic vào trong code của user interface"_ — cùng với vấn đề đối xứng tương tự ở phía database. Cả hai đều phát sinh từ cùng một nguyên nhân gốc rễ: _"sự quấn chặt giữa business logic và việc tương tác với các thực thể bên ngoài."_ "Giải pháp" trong lịch sử — thêm vào thêm một lớp nữa kèm lời hứa rằng "lần này, thật sự và chắc chắn, sẽ không có business logic nào bị đặt vào lớp mới này" — liên tục thất bại, bởi vì không có cơ chế _mang tính cấu trúc_ nào ép buộc lời hứa đó. Hexagonal Architecture cung cấp đúng cái cơ chế cấu trúc đó thông qua ranh giới ports-and-adapters.

### 2. Lịch sử và Nguồn gốc

Dòng thời gian, được tái dựng từ chính cuộc phỏng vấn của Cockburn với Juan Manuel Garrido de Paz và từ cuốn sách _Hexagonal Architecture Explained_ (2024):

| Năm                    | Sự kiện                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **1994**               | Cockburn vẽ sơ đồ lục giác lần đầu trong ghi chú khóa học của ông, sau một dự án fixed-price (khoán trọn gói) nơi các nhà thiết kế hạ tầng buộc phải viết lại object-relational mapper (bộ ánh xạ đối tượng - quan hệ) của họ, chỉ vì các lập trình viên application không thể thay thế bằng một test database in-memory (cơ sở dữ liệu kiểm thử nằm trong bộ nhớ). _("Chúng tôi đã bị bỏng vì thiếu vắng nó trong dự án 1994, và với tư cách một lập trình viên, tôi biết là làm được.")_ |
| **1998**               | Cockburn bắt đầu nói về pattern này một cách công khai. Kevin Rutherford sau này viết: _"Kể từ khi nghe về nó (khoảng năm 1998 hay tầm đó) tôi vẫn luôn cố thuyết phục mọi người tư duy theo mô hình hexagonal architecture của Alistair Cockburn."_                                                                                                                                                                                                                                       |
| **~2004**              | Cockburn đăng nó lên WikiWikiWeb của Ward Cunningham (c2.com) dưới trang _HexagonalArchitecture_.                                                                                                                                                                                                                                                                                                                                                                                          |
| **Tháng 6 năm 2005**   | _"Khoảnh khắc lóe sáng"_: Cockburn nhận ra các mặt của hình lục giác chính là **port**, và các đối tượng nằm giữa hai hình lục giác chính là **adapter**. Ông đề xuất tên gọi thay thế _Ports and Adapters Architecture_.                                                                                                                                                                                                                                                                  |
| **4 tháng 9 năm 2005** | Xuất bản bài viết kinh điển _"Hexagonal (Ports & Adapters) Architecture — HaT Technical Report 2005.02"_ trên alistair.cockburn.us, kèm theo code Java mẫu hoạt động được và các ví dụ FIT.                                                                                                                                                                                                                                                                                                |
| **2009**               | Steve Freeman và Nat Pryce xuất bản _Growing Object-Oriented Software, Guided by Tests_ (Pearson/Addison-Wesley, 2009), mang lại cho pattern sự ủng hộ ở quy mô một cuốn sách nổi bật đầu tiên trong cộng đồng OO/TDD rộng lớn hơn.                                                                                                                                                                                                                                                        |
| **~2010–2012**         | Cộng đồng Domain-Driven Design (Thiết kế hướng miền nghiệp vụ) tiếp nhận pattern này _"để dựng một bức tường quanh domain model và đẩy công nghệ ra khỏi đường đi của họ"_ (theo cách diễn giải của Cockburn).                                                                                                                                                                                                                                                                             |
| **2015**               | Cockburn hình thức hóa thuật ngữ driving / driven và quy ước đặt tên interface theo kiểu `for_doing_something` (cho việc làm-gì-đó).                                                                                                                                                                                                                                                                                                                                                       |
| **2020**               | Netflix Tech Blog xuất bản case study (nghiên cứu tình huống) ủng hộ pattern.                                                                                                                                                                                                                                                                                                                                                                                                              |
| **Tháng 4 năm 2024**   | Cockburn và Juan Manuel Garrido de Paz xuất bản _Hexagonal Architecture Explained_ — cuốn sách ở quy mô đầy đủ đầu tiên do chính tác giả của pattern viết.                                                                                                                                                                                                                                                                                                                                 |

**Động cơ** (Cockburn, bài viết gốc): vấn đề phía người dùng (business logic rò rỉ vào UI; không thể được điều khiển theo lô; không thể kiểm thử mà không có GUI) và vấn đề phía database (lập trình viên bị chặn đứng khi DB không sẵn sàng; không thể tráo SQL bằng mock/in-memory) thực ra là _cùng một vấn đề khi nhìn theo cách đối xứng_. Việc nhận ra sự đối xứng này chính là trái tim của pattern.

### 3. Tiến hóa và Các tên gọi liên quan

#### 3.1 Ports and Adapters (tên gọi mà Cockburn ưa thích hơn)

Bản thân Cockburn ưa thích tên **"Ports and Adapters"** hơn, bởi vì nó gọi tên các _bộ phận_ của cấu trúc. Trong cuộc phỏng vấn năm 2017 với InfoQ, ông một lần nữa khẳng định điều này. _Hình dạng_ lục giác chỉ đơn thuần là một sự tiện lợi khi vẽ sơ đồ.

#### 3.2 Onion Architecture (Kiến trúc củ hành — Jeffrey Palermo, 2008)

Jeffrey Palermo xuất bản một loạt bài blog gồm bốn phần, bắt đầu lúc **8 giờ 8 phút sáng ngày 29 tháng 7 năm 2008** với bài _"The Onion Architecture: part 1"_. Phần 2 nối tiếp lúc **8 giờ 14 phút sáng ngày 30 tháng 7 năm 2008**; **Phần 3 mang dấu thời gian chính xác trên blog là "Jeffrey Palermo 9:34 am ngày 4 tháng 8 năm 2008"**; và **Phần 4 ("Onion Architecture: Part 4 – After Four Years", tức Sau Bốn Năm) mang dấu thời gian "Jeffrey Palermo 8:19 am ngày 19 tháng 8 năm 2013"**.

**Bốn nguyên lý cốt lõi** của Palermo (trích nguyên văn từ Phần 3, được lặp lại trong Phần 4):

1. _"Application được xây dựng xoay quanh một object model (mô hình đối tượng) độc lập"_
2. _"Các lớp bên trong định nghĩa interface. Các lớp bên ngoài triển khai interface"_
3. _"Chiều của coupling (sự gắn kết) hướng về phía trung tâm"_
4. _"Toàn bộ code lõi của application có thể được biên dịch và chạy tách biệt khỏi infrastructure"_

Các lớp có tên mà Palermo định nghĩa trong Phần 1 là:

- **Domain Model** (mô hình miền nghiệp vụ) ở chính giữa trung tâm
- Một lớp bao quanh chứa các **repository interface** ("những interface cung cấp hành vi lưu và truy xuất đối tượng")
- **Application core** (lõi ứng dụng) là thuật ngữ tập thể chỉ các vòng bên trong
- **UI, Infrastructure, và Tests** là những mép ngoài cùng

(Các nhãn "Domain Services / Application Services" được lặp lại rộng rãi _không_ nằm trong cách diễn đạt gốc năm 2008 của Palermo — chúng được những người bình luận và những sơ đồ về sau bổ sung vào.)

**Điểm khác biệt chính so với N-tier**, trích nguyên văn từ Phần 3: _"Khác biệt lớn nằm ở chỗ bất kỳ lớp bên ngoài nào cũng có thể gọi trực tiếp bất kỳ lớp bên trong nào. Với kiến trúc phân tầng truyền thống, một lớp chỉ có thể gọi lớp nằm ngay bên dưới nó. Đây là một trong những điểm mấu chốt khiến Onion Architecture khác với kiến trúc phân tầng truyền thống."_

**Mối quan hệ với Hexagonal**, do chính Palermo phát biểu ở cuối Phần 1: _"Hexagonal architecture và Onion Architecture chia sẻ tiền đề sau: Đưa infrastructure ra ngoài và viết code adapter sao cho infrastructure không trở nên gắn kết chặt chẽ."_

Vậy nên Onion = Hexagonal + một tập hợp các lớp đồng tâm _bên trong_ có quan điểm rõ ràng.

#### 3.3 Clean Architecture (Kiến trúc sạch — Robert C. Martin / "Uncle Bob", 2012)

Được xuất bản trên blog của ông vào ngày **13 tháng 8 năm 2012** (bài "The Clean Architecture"), và sau này được mở rộng thành cuốn sách năm 2017 _Clean Architecture: A Craftsman's Guide to Software Structure and Design_. Martin định vị nó một cách rõ ràng như một sự _tích hợp_ các pattern có trước:

> _"Sơ đồ ở đầu bài viết này là một nỗ lực tích hợp tất cả những kiến trúc đó vào một ý tưởng đơn lẻ có thể hành động được."_

— với việc trích dẫn Hexagonal (Cockburn), Onion (Palermo), DCI (Coplien/Reenskaug), BCE (Jacobson), và Screaming Architecture của chính ông như những đầu vào.

Clean Architecture định nghĩa bốn vòng đồng tâm kinh điển (từ trong ra ngoài):

1. **Entities** (Thực thể) — _"đóng gói các business rule (quy tắc nghiệp vụ) ở quy mô toàn doanh nghiệp"_
2. **Use Cases** (Ca sử dụng) — _"các business rule đặc thù cho application"_
3. **Interface Adapters** (Bộ chuyển đổi giao diện) — _"một tập hợp các adapter chuyển đổi dữ liệu từ định dạng thuận tiện nhất cho use case và entity, sang định dạng thuận tiện nhất cho một cơ quan bên ngoài nào đó như Database hay Web"_
4. **Frameworks and Drivers** (Khung lập trình và Trình điều khiển) — _"Database, Web Framework, v.v. Nói chung bạn không viết nhiều code trong lớp này ngoài glue code (code keo dán) giao tiếp với vòng kế tiếp bên trong."_

Quy tắc then chốt, **The Dependency Rule** (Quy tắc phụ thuộc), trích nguyên văn:

> _"Source code dependency chỉ có thể trỏ vào trong. Không thứ gì ở vòng trong được biết bất cứ điều gì về thứ gì đó ở vòng ngoài."_

#### 3.4 Chúng liên hệ với nhau như thế nào

| Khía cạnh                    | Hexagonal (2005)                                    | Onion (2008)                                                      | Clean (2012)                                                  |
| ---------------------------- | --------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------- |
| Số lớp bên trong được nêu rõ | 1 (chỉ "the hexagon / application")                 | Vài lớp (Domain Model + repository interfaces + application core) | 4 (Entities, Use Cases, Interface Adapters, Frameworks)       |
| Đặt tên cho cơ chế ranh giới | **Ports** và **Adapters**                           | Interface định nghĩa vào trong, triển khai ra ngoài               | "Boundaries" (Ranh giới) với Input/Output Ports               |
| Quy tắc phụ thuộc tường minh | Ngầm định ("bên trong không gắn kết với bên ngoài") | Tường minh ("mọi coupling đều hướng về trung tâm")                | Tường minh và được đặt tên ("The Dependency Rule")            |
| Bản vẽ đối xứng              | Có (hình lục giác, đối xứng trái/phải của các port) | Có (các vòng tròn đồng tâm)                                       | Có (vòng tròn đồng tâm + một phần phụ về luồng điều khiển)    |
| Điểm mạnh                    | Sự đối xứng giữa phía UI và phía DB                 | Việc phân lớp bên trong core                                      | Mức độ chi tiết và công thức tường minh để băng qua ranh giới |

Herberto Graça tóm tắt khá hay: Onion _xây dựng dựa trên_ Ports & Adapters bằng cách thêm tổ chức bên trong; Clean _tích hợp_ cả hai cùng với DCI và BCE. **Cả ba đều chia sẻ cùng một ý tưởng cốt lõi**: đặt domain vào trung tâm, đưa các delivery mechanism (cơ chế phân phối) và infrastructure ra ngoài, và để các phụ thuộc trỏ vào trong.

#### 3.5 Mối quan hệ với Domain-Driven Design (DDD)

Hexagonal Architecture và DDD **bổ trợ cho nhau nhưng độc lập với nhau**. Chính Cockburn lưu ý rằng cộng đồng DDD đã tiếp nhận pattern của ông vào khoảng 2010–2012 _"để dựng một bức tường quanh domain model và đẩy công nghệ ra khỏi đường đi của họ."_ Pattern này _không quy định_ cách tổ chức code _bên trong_ hình lục giác — khoảng trống đó được lấp đầy một cách tự nhiên bởi các tactical pattern (mẫu chiến thuật) của DDD: **Entities, Value Objects (Đối tượng giá trị), Aggregates (Khối tổng hợp), Domain Services (Dịch vụ miền nghiệp vụ), Application Services (Dịch vụ ứng dụng), Repositories (Kho chứa)**. Cuốn _Growing Object-Oriented Software, Guided by Tests_ (2009) của Freeman và Pryce là một sự ghép đôi có ảnh hưởng từ sớm. Ngày nay, khi lập trình viên nói "DDD + Hexagonal", họ thường ngụ ý: một hình lục giác cho mỗi **Bounded Context** (Ngữ cảnh giới hạn), với các tactical pattern của DDD lấp đầy bên trong.

### 4. The Dependency Rule — Chiều phụ thuộc đối lại Chiều luồng điều khiển

Đây là bản lề khái niệm của toàn bộ gia đình pattern này, và là điểm hay bị hiểu sai nhất. Đây cũng chính là điều bạn đã hỏi tới một cách rõ ràng.

#### 4.1 Hai "mũi tên" khác nhau

Giữa hai module (mô-đun) phần mềm bất kỳ là `A` và `B`, luôn tồn tại **hai mũi tên**:

1. **Source-code dependency** (phụ thuộc mã nguồn — mũi tên lúc biên dịch, _chiều phụ thuộc_): "module A _import_ (nhập) / _tham chiếu tới tên của_ module B." Đây là một quan hệ _tĩnh, mang tính văn bản_, có thể nhìn thấy bằng lệnh `grep`. Nếu bạn xóa file B đi, file A sẽ không biên dịch được.

2. **Flow of control / call direction** (luồng điều khiển / chiều lời gọi — mũi tên lúc chạy, _chiều gọi hàm_): "lúc chạy, code trong A _triệu gọi_ code trong B." Đây là quan hệ _động_. Đó là cái mà debugger (trình gỡ lỗi) cho bạn thấy.

Trong code ngây thơ (chưa áp dụng kỹ thuật gì), hai mũi tên này trỏ _cùng một hướng_: nếu `A` gọi `B` lúc chạy, thì file mã nguồn của `A` sẽ `import` class của `B`. **Dependency Inversion** chính là kỹ thuật cho phép bạn làm cho hai mũi tên này trỏ về hai hướng _ngược nhau_.

#### 4.2 Phát biểu kinh điển của Uncle Bob

Trích từ _The Clean Architecture_ (2012):

> _"Chúng ta thường giải quyết mâu thuẫn bề ngoài này bằng cách dùng Dependency Inversion Principle. Trong một ngôn ngữ như Java chẳng hạn, chúng ta sẽ sắp xếp các interface và các quan hệ kế thừa sao cho các source code dependency đối nghịch với flow of control tại đúng những điểm cần thiết khi băng qua ranh giới. […] Chúng ta tận dụng dynamic polymorphism để tạo ra các source code dependency đi ngược lại flow of control, để chúng ta tuân thủ được The Dependency Rule bất kể flow of control đang đi theo hướng nào."_

#### 4.3 Phía inbound (driving): hai mũi tên trùng nhau

Người dùng nhấn một nút → framework HTTP triệu gọi `UserController.create()` → hàm này gọi `CreateUserUseCase.execute(input)` (được định nghĩa trong core).

- **Luồng điều khiển**: Controller → UseCase ✓ (từ ngoài vào trong)
- **Phụ thuộc mã nguồn**: Controller `import` UseCase (vì nó buộc phải biết tên của UseCase) ✓ (từ ngoài vào trong)

Cả hai mũi tên đều trỏ _vào trong_. Ở đây Dependency Inversion _không bắt buộc về mặt nghiêm ngặt_, mặc dù nhiều codebase (mã nguồn dự án) vẫn đưa vào một inbound port (một interface cho use case) để controller phụ thuộc vào một abstraction (sự trừu tượng) thay vì một service cụ thể — điều này mang lại khả năng mock (giả lập) và một API mang tính hợp đồng cho core. Tom Hombergs, trong cuốn _Get Your Hands Dirty on Clean Architecture_ (Packt Publishing, tháng 9 năm 2019, ISBN 978-1-839211-96-6; ấn bản thứ hai năm 2023), sử dụng quy ước này — ông gọi chúng là **incoming port** / **driving port**, thường được đặt tên theo kiểu `for_doing_something` mà Cockburn khuyến nghị, ví dụ `ForRegisteringUsers`.

#### 4.4 Phía outbound (driven): hai mũi tên ngược nhau — đây mới là chìa khóa

Một use case cần lưu một user → lúc chạy luồng điều khiển đi `UseCase → Repository → SQL`.

Nếu ta viết một cách ngây thơ (`UseCase` `import` trực tiếp `PostgresUserRepository`), thì phụ thuộc mã nguồn sẽ trỏ _ra ngoài_ (core → infrastructure), vi phạm The Dependency Rule.

**Mẹo** (Dependency Inversion):

1. Trong **core**, định nghĩa một interface `UserRepository` (đây là **secondary / driven port** — cổng thụ động).
2. **Use case** phụ thuộc vào `UserRepository` (cái interface này nằm _bên trong_ core).
3. Trong lớp **adapter** (bên ngoài core), class `PostgresUserRepository` _triển khai_ (implement) `UserRepository`.

Bây giờ:

- **Luồng điều khiển**: UseCase → PostgresUserRepository ✓ (từ trong ra ngoài lúc chạy — use case thực sự gọi tới database)
- **Phụ thuộc mã nguồn**: PostgresUserRepository `import` và `implement` UserRepository ✓ (từ ngoài vào trong lúc biên dịch)

Hai mũi tên _ngược nhau_. Adapter ở ngoài phụ thuộc vào core (vì nó triển khai interface của core); còn core thì _không_ phụ thuộc vào _bất cứ thứ gì_ bên ngoài nó.

Về mặt hình ảnh, đây chính là _"sơ đồ phụ nhỏ ở góc dưới bên phải"_ trong bức hình Clean Architecture của Uncle Bob: luồng điều khiển đi theo một hướng khi băng qua ranh giới; các source dependency thì băng qua ranh giới đó theo hướng _ngược lại_.

#### 4.5 Sơ đồ minh họa hai mũi tên

```
                          RANH GIỚI (boundary)
                                  │
   PHÍA DRIVING (bên trái)        │        PHÍA DRIVEN (bên phải)
   ────────────────────────      │      ────────────────────────
                                  │
   ┌──────────────┐              │              ┌─────────────────────┐
   │  Controller  │              │              │ PostgresUserReposit.│
   │  (adapter)   │              │              │     (adapter)       │
   └──────┬───────┘              │              └──────────┬──────────┘
          │                      │                         │
          │ phụ thuộc + gọi      │      gọi (call) │       │ phụ thuộc (implement)
          │ (cùng chiều,         │   ───────────►  │       │ (ngược chiều
          │  vào trong)          │                 │       │  với lời gọi)
          ▼                      │                 │       ▼
   ┌────────────────────────────┴─────────────────┴────────────────┐
   │                          CORE (lõi)                            │
   │  ┌────────────────┐         gọi ra ngoài    ┌───────────────┐  │
   │  │ RegisterUser   │ ──────────────────────► │ UserRepository│  │
   │  │  (use case)    │   (control flow OUT)    │   (port =     │  │
   │  │                │ ◄────────────────────── │   interface)  │  │
   │  └────────────────┘   phụ thuộc IN (dep)    └───────────────┘  │
   │                                                                │
   └────────────────────────────────────────────────────────────────┘

   Chú thích:
   • Mũi tên LIỀN  = control flow / lời gọi lúc chạy (runtime call)
   • Mũi tên ĐỨT   = source-code dependency (phụ thuộc lúc biên dịch)
   • Phía DRIVING : hai mũi tên CÙNG hướng (đều vào trong) → DIP không bắt buộc
   • Phía DRIVEN  : hai mũi tên NGƯỢC hướng → đây là nơi DIP phát huy tác dụng
```

#### 4.6 Diễn giải bằng TypeScript

```typescript
// ── core/ports/UserRepository.ts
// (ĐÂY LÀ PORT, được định nghĩa bởi chính core)
// Đây chỉ là một bản hợp đồng (contract): nó nói "core cần được lưu và
// tìm user", nhưng KHÔNG nói gì về việc lưu bằng công nghệ nào.
export interface UserRepository {
  save(user: User): Promise<void>;
  findById(id: UserId): Promise<User | null>;
}

// ── core/usecases/RegisterUser.ts
// (use case chỉ phụ thuộc vào port, tức vào abstraction)
export class RegisterUser {
  // Constructor nhận vào một thứ gì đó thỏa mãn interface UserRepository.
  // Use case KHÔNG biết đó là Postgres, Mongo, hay bộ nhớ tạm.
  // Đây là mũi tên PHỤ THUỘC, trỏ VÀO TRONG
  // (use case -> port, cả hai cùng nằm trong core).
  constructor(private readonly users: UserRepository) {}

  async execute(cmd: RegisterUserCommand): Promise<void> {
    // Tạo ra một đối tượng domain thuần túy.
    const user = User.create(cmd.email, cmd.name);

    // Đây là LỜI GỌI hướng RA NGOÀI (outbound call):
    // lúc chạy, dòng này thực sự đi tới database để lưu.
    // Chiều LỜI GỌI (ra ngoài) ngược với chiều PHỤ THUỘC (vào trong).
    await this.users.save(user);
  }
}

// ── adapters/persistence/PostgresUserRepository.ts
// (nằm BÊN NGOÀI core)
// Lưu ý: chính file adapter này import port từ core.
// Đây là mũi tên PHỤ THUỘC trỏ VÀO TRONG (adapter ngoài -> port trong core).
import { UserRepository } from "../../core/ports/UserRepository";

export class PostgresUserRepository implements UserRepository {
  // Triển khai cụ thể: ở đây mới có code SQL thật.
  async save(user: User): Promise<void> {
    // ... code SQL để chèn vào bảng users ...
  }
  async findById(id: UserId): Promise<User | null> {
    // ... code SQL để truy vấn ...
    return null; // (giản lược cho ví dụ)
  }
}
```

Hãy lưu ý rằng **chỉ có file adapter nhắc tới Postgres**. Thư mục `core/` có số lượng `import` từ `pg`, `typeorm`, hay bất kỳ gói infrastructure nào bằng không. Bạn có thể chạy `tsc --noEmit core/` (biên dịch kiểm tra riêng phần core) một cách tách biệt và nó vẫn biên dịch thành công. Đó chính là phép thử mang tính vận hành để biết bạn đã triển khai pattern đúng hay chưa.

#### 4.7 Tại sao điều này quan trọng

Sự đảo ngược này mở khóa mọi lợi ích mà pattern được quảng cáo:

- **Testability** (khả năng kiểm thử): tráo vào một `InMemoryUserRepository` trong các bài test; use case không hề hay biết.
- **Swappability** (khả năng tráo đổi): thay Postgres bằng DynamoDB bằng cách viết một adapter mới; core không phải biên dịch lại.
- **Phát triển song song**: cả đội có thể xây dựng các use case dựa trên interface port trước khi database được chọn.
- **Phát hiện rò rỉ**: bất kỳ nỗ lực nào nhằm `import` một kiểu dữ liệu của framework từ bên trong core giờ đây đều trở thành một vi phạm kiến trúc nhìn thấy được, có thể được ép buộc bằng các công cụ như `dependency-cruiser` hoặc các công cụ tương đương ArchUnit.

### 5. Giải thích chi tiết về Ports và Adapters

#### 5.1 Port (cổng)

Một **port** là _"một cuộc đối thoại có mục đích"_ (a purposeful conversation) giữa application và thế giới bên ngoài (theo Cockburn). Trong code, nó hầu như luôn là một **interface** (`interface` hoặc abstract class — lớp trừu tượng — của TypeScript) _được định nghĩa bởi và sống bên trong core_. Nó được diễn đạt bằng **từ vựng nghiệp vụ**, chứ không phải bằng thuật ngữ công nghệ — Cockburn khuyến nghị những cái tên như `ForRegisteringUsers` (cho việc đăng ký người dùng), `ForObtainingRates` (cho việc lấy tỷ giá), `ForStoringPermits` (cho việc lưu giấy phép). Port mô tả _cái gì_ mà application cần từ hoặc cung cấp cho bên ngoài, chứ không bao giờ mô tả _bằng cách nào_.

#### 5.2 Adapter (bộ chuyển đổi)

Một **adapter** là phần triển khai _đặc thù cho công nghệ_, nối một port với một thiết bị, framework, hoặc protocol (giao thức) thật. Lời của Cockburn: _"Thường sẽ có nhiều adapter cho bất kỳ một port nào, ứng với các công nghệ khác nhau có thể cắm vào port đó. Điển hình, chúng có thể bao gồm … một giao diện người dùng đồ họa, một test harness (giàn kiểm thử), một batch driver (trình điều khiển theo lô), một giao diện http … một mock database (in-memory), một database thật."_

Bản thân adapter pattern chính là mẫu _Adapter_ của GoF (Gamma và cộng sự, 1995); Cockburn nói rõ Ports & Adapters là _"một cách sử dụng cụ thể của Adapter pattern."_

#### 5.3 Primary (driving) ports và adapters — phía bên trái

- **Primary / driving / inbound** (chủ động / điều khiển / hướng vào) = một thứ gì đó _bên ngoài_ điều khiển application.
- **Primary port** = chính là _API của application_ — tập hợp các thao tác mà core _cung cấp_ (thường được gọi là "use case" trong cách nói của DDD/Clean).
- **Primary adapter** = công nghệ chuyển dịch một sự kiện bên ngoài thành một lời gọi vào primary port.

Ví dụ về primary adapter: một **REST controller**, một **GraphQL resolver**, một **điểm vào CLI**, một **message-queue consumer** (bộ tiêu thụ hàng đợi tin nhắn — đúng vậy, một Kafka listener là một adapter _điều khiển_, vì tin nhắn _điều khiển_ application), một **HTTP webhook handler**, một **test fixture** (FIT, Cucumber, hoặc một bài test Jest thuần túy chạy thẳng use case), hoặc một **scheduled job** (công việc theo lịch) được kích hoạt bởi `cron`.

Mối quan hệ: _driver adapter_ có một **phụ thuộc có thể cấu hình được** vào _driver port_, và _driver port_ thì _được triển khai bởi_ core (cụ thể là bởi class use-case / application-service).

#### 5.4 Secondary (driven) ports và adapters — phía bên phải

- **Secondary / driven / outbound** (thụ động / bị điều khiển / hướng ra) = một thứ gì đó _bên ngoài_ bị application điều khiển.
- **Secondary port** = một interface mà core _cần được đáp ứng_ (một "Service Provider Interface" — Giao diện nhà cung cấp dịch vụ, viết tắt SPI).
- **Secondary adapter** = công nghệ đáp ứng nó.

Ví dụ về secondary adapter: một **database repository** (Postgres, Mongo, DynamoDB), một **bộ gửi email** (SMTP, SendGrid), một **REST/gRPC client bên ngoài** (Stripe, hoặc một microservice nội bộ), một **message-queue producer** (bộ sản xuất hàng đợi tin nhắn), một **bộ ghi file / S3**, một **logger** (bộ ghi nhật ký), một **clock** (đồng hồ — đúng vậy, ngay cả `new Date()` cũng nên được trừu tượng hóa sau một port để phục vụ kiểm thử; cả Hombergs lẫn đội QWAN đều lưu ý rằng ngay cả các thư viện cho thời gian, UUID, và logging cũng _"có xu hướng cản đường"_ và được hưởng lợi khi được bọc lại).

Mối quan hệ: _core_ có một phụ thuộc có thể cấu hình được vào _driven port_; còn _driven adapter triển khai_ port đó. Đây chính là nơi Dependency Inversion diễn ra (xem mục 4.4).

#### 5.5 Sự bất đối xứng giữa hai phía (tinh tế nhưng quan trọng)

Cockburn nhấn mạnh điều này trong phần _Application Notes_ của bài viết: mặc dù các port được vẽ một cách đối xứng quanh hình lục giác, nhưng trong triển khai chúng lại bất đối xứng — _"các thao tác của driver port được gọi bởi một adapter, trong khi các thao tác của driven port được triển khai bởi một adapter"_ (Garrido de Paz). Đây cũng là lý do tại sao chiến lược kiểm thử cũng bất đối xứng: thiết lập kinh điển của Cockburn dùng **FIT/Cucumber fixture** làm test adapter mặc định ở phía driving, và dùng các **bản triển khai mock/in-memory** làm test adapter mặc định ở phía driven.

#### 5.6 Khả năng kiểm thử và khả năng tráo đổi nảy sinh như thế nào

Bởi vì core chỉ phụ thuộc vào các port:

- **Kiểm thử core hoàn toàn tách biệt**: cung cấp các test-double adapter (adapter đóng thế dùng cho kiểm thử) cho cả hai phía. Không cần HTTP server, không cần database, không cần container của Spring/Nest. Các bài test nhanh và tất định (deterministic). (Đây chính là cái Cockburn gọi là chạy application ở chế độ _"fully isolated mode"_ — chế độ cô lập hoàn toàn.)
- **Kiểm thử tích hợp từng adapter một cách riêng lẻ** so với công nghệ thật của nó (chẳng hạn một Postgres thật trong Testcontainers).
- **Kiểm thử toàn hệ thống** chỉ ở các mép ngoài.
- **Tráo đổi các bản triển khai** lúc khởi động. Trường hợp Netflix đã được ghi nhận: họ thay một repository adapter dạng JSON-API bằng một bản dùng GraphQL để vượt qua một ràng buộc về tốc độ đọc — _"Một thay đổi đơn giản chỉ một dòng là tất cả những gì chúng tôi cần để bắt đầu đọc từ một nguồn dữ liệu khác"_ (Svrtan & Makagon, Netflix TechBlog, 10 tháng 3 năm 2020). Logic của use case hoàn toàn không bị động chạm.

### 6. So sánh với Traditional Layered (N-tier) Architecture

#### 6.1 Kiến trúc phân tầng truyền thống trông như thế nào

Presentation (Trình bày) → Business Logic (Logic nghiệp vụ) → Data Access (Truy cập dữ liệu) → Database. Mỗi lớp phụ thuộc vào lớp nằm bên dưới nó (một chuỗi từ trên xuống). Bắt nguồn từ cuốn _Patterns of Enterprise Application Architecture_ (2002) của Fowler.

#### 6.2 Nó sai ở chỗ nào

Bệnh lý mà Cockburn chẩn đoán trong bài viết 2005 của ông áp dụng cụ thể cho N-tier:

> _"Đầu tiên và tệ nhất, người ta có xu hướng không xem trọng những 'đường kẻ' trong bản vẽ phân tầng. Họ để logic của application rò rỉ băng qua các ranh giới tầng. […] Thứ hai, có thể có hơn hai port vào application, khiến cho kiến trúc không vừa vặn với bản vẽ phân tầng một chiều."_

Các triệu chứng cụ thể:

- **Thiết kế bị database dẫn dắt** (database-driven design): các đối tượng domain trở thành những bản sao thiếu máu (anemic) của các hàng trong database; cái schema (lược đồ) ra lệnh cho mô hình.
- **Business logic nằm trong controller** (như câu lệnh "`if (request.body.amount > 100) …`" xuất hiện trong một HTTP handler).
- **Business logic phụ thuộc bắc cầu vào infrastructure**: việc đổi ORM gây ra hiệu ứng gợn sóng lan ngược lên cả ngăn xếp.
- **Khó kiểm thử**: bạn không thể kiểm thử các business rule mà không dựng lên một DB.

#### 6.3 Hexagonal làm khác đi điều gì

| Khía cạnh                       | N-tier / Layered                                    | Hexagonal                                     |
| ------------------------------- | --------------------------------------------------- | --------------------------------------------- |
| Hình dạng                       | Ngăn xếp một chiều                                  | Trong-ra-ngoài (hình lục giác)                |
| Chiều phụ thuộc                 | Trên → dưới (presentation phụ thuộc data access)    | Ngoài → trong (mọi thứ phụ thuộc domain)      |
| Vị trí của database             | Là nền móng, ở dưới đáy                             | Là một _chi tiết bên ngoài_, nằm ở phía ngoài |
| Số lượng "port"                 | Hai port ngầm định (trên, dưới)                     | Số lượng bất kỳ (Cockburn nói thực tế là 2–4) |
| Domain phụ thuộc vào            | Data access                                         | Không gì bên ngoài nó cả                      |
| Khả năng kiểm thử business rule | Đòi hỏi các lớp bên dưới phải sẵn sàng hoặc bị mock | Tầm thường — core là thuần túy                |
| Phù hợp nhất với                | CRUD đơn giản, app nhỏ                              | Domain phức tạp, hệ thống sống lâu            |

#### 6.4 Ưu điểm của hexagonal

- Độc lập khỏi framework, UI, database, và các cơ quan bên ngoài (năm thuộc tính của Uncle Bob).
- Khả năng kiểm thử cao — các business rule được kiểm thử mà không cần UI, DB, hay web server.
- Xử lý đối xứng giữa các nguồn đầu vào và đầu ra.
- Ăn khớp tự nhiên với DDD và Bounded Context.
- Bền bỉ trước thay đổi hạ tầng (câu chuyện Netflix).

#### 6.5 Nhược điểm của hexagonal

- Phức tạp hơn ngay từ đầu: nhiều interface hơn, nhiều file hơn, nhiều lớp gián tiếp hơn.
- Nhiều boilerplate (code mẫu lặp đi lặp lại) hơn trong các dự án nhỏ — có thể thoái hóa thành những "interface vô dụng" mà mỗi cái chỉ có một bản triển khai duy nhất.
- Đường cong học tập dốc hơn, đặc biệt với những lập trình viên quen với ngăn xếp kiểu Rails hay Spring-MVC.
- Việc ánh xạ giữa đối tượng - port - DTO làm tăng thêm code (Hombergs dành hẳn một chương cho các chiến lược ánh xạ: _No-Mapping_ (Không ánh xạ), _Two-Way_ (Hai chiều), _Full_ (Đầy đủ), và _One-Way_ (Một chiều)).
- Với những bài toán thực sự mang hình hài CRUD, các sự trừu tượng hóa này mang lại rất ít giá trị.

### 7. Các cân nhắc thực tiễn

#### 7.1 Khi nào nên dùng nó

Phù hợp mạnh:

- **Các application nghiệp vụ sống lâu** nơi độ phức tạp của domain vượt quá mức CRUD.
- Các hệ thống nơi **các điểm tích hợp có khả năng sẽ thay đổi** trong suốt vòng đời của hệ thống (database, nhà cung cấp thanh toán, nhà cung cấp danh tính, message broker).
- Các codebase hưởng lợi từ một **test pyramid (kim tự tháp kiểm thử) vững chắc** — các bài unit test nhanh cho core, các bài integration test hẹp hơn cho adapter.
- **Bounded context trong một chiến lược DDD**, hoặc các microservice nơi mỗi service sở hữu một hình lục giác.
- Các đội đang áp dụng **TDD** — kiến trúc và TDD củng cố lẫn nhau (Cockburn, Hombergs, và Valentina Cupać đều nhấn mạnh điều này).

Phù hợp yếu:

- Các bản prototype dùng một lần, các MVP, và các trang quản trị (admin panel) nơi tốc độ ra thị trường là tối thượng.
- CRUD đơn giản nơi "domain" về cơ bản chỉ là `INSERT / SELECT / UPDATE / DELETE`.
- Các đội chưa có sự hiểu biết chung về dependency inversion — pattern sẽ thất bại một cách rõ ràng nếu thiếu nền tảng đó.

#### 7.2 Các sai lầm thường gặp

- **Interface vô dụng**: đưa vào một port chỉ có đúng một bản triển khai trong môi trường production và không hề được dùng trong kiểm thử. Lời khuyên của Victor Rentea: _"loại bỏ chúng trừ khi có ≥2 bản triển khai hoặc đang dùng cho Dependency Inversion."_
- **Business logic nằm trong adapter**: một controller tính toán chiết khấu, hoặc một repository quyết định các quy tắc nghiệp vụ. Adapter chỉ nên _chuyển dịch và ủy thác, không bao giờ chứa business logic_ (Hombergs).
- **Core thiếu máu (anemic core)**: use case trở thành một kẻ chuyển tiếp đơn thuần tới repository. Nếu use case của bạn chỉ dài một dòng — `return this.repo.findById(id)` — thì bạn không có domain, bạn chỉ có một REST proxy mỏng. Hãy gộp các lớp lại.
- **Phân lớp quá nghiêm ngặt**: cấm controller tham chiếu trực tiếp tới một domain entity, ép buộc phải sao chép qua ba lớp. Cả Onion lẫn Clean đều cho phép bất kỳ lớp ngoài nào gọi trực tiếp bất kỳ lớp trong nào.
- **Sự phụ thuộc lẫn nhau giữa các use case**: một application service gọi một application service khác. Điều này tạo ra một anti-pattern (mẫu phản diện) kiểu "tổng đài điện thoại". Các use case nên là anh em chia sẻ chung domain, chứ không phải cha mẹ của nhau.
- **Framework nằm ở trung tâm**: các annotation của Spring, các decorator của NestJS, `@Entity` của TypeORM gắn lên các class domain. Core nên là các class TypeScript thuần túy.
- **Nhầm lẫn "Hexagonal" với "có các lớp"**: bài viết gốc không bao giờ dùng từ "layer" (lớp/tầng). _Bên trong_ và _bên ngoài_ là hai vùng duy nhất mà Cockburn định nghĩa; mọi thứ khác là quyết định của bạn.

#### 7.3 Các đánh đổi (Trade-offs)

- **Nhiều file hơn, làm quen chậm hơn** để đổi lấy sự linh hoạt trong dài hạn.
- **Nhiều test hơn sẽ được đền đáp về sau**: đầu tư ban đầu vào giàn giáo kiểm thử, thu hồi qua nhiều năm.
- **Có thể bạn chưa cần đến nó vội**: một con đường thực dụng phổ biến là _bắt đầu đơn giản_ (một module, không interface) và _chỉ tách port ra khi một adapter thứ hai xuất hiện hoặc khi nhu cầu kiểm thử đòi hỏi_. Đây là lời khuyên từ Rentea, Hombergs ("Bắt đầu đơn giản, tiến hóa domain dần"), và đội QWAN.

#### 7.4 Các sơ đồ nên vẽ trong phần giải thích

Ba sơ đồ truyền đạt được mô hình khái niệm — như được mô tả trong các nguồn:

1. **Sơ đồ hình lục giác** (Cockburn, Hình 2 trong bài viết 2005): một hình lục giác trung tâm dán nhãn "Application"; nhiều port trên đường biên của nó; các port phía trái được bao quanh bởi các driving adapter (REST, CLI, Test); các port phía phải được bao quanh bởi các driven adapter (Postgres, Mock DB, External API). Các mũi tên cho thấy các actor đi vào từ bên trái và bị gọi ra ở bên phải.

```
                  DRIVING SIDE                          DRIVEN SIDE
              (primary adapters)                    (secondary adapters)

   ┌─────────┐   ┌─────────┐                      ┌──────────┐   ┌──────────┐
   │  REST   │   │   CLI   │                      │ Postgres │   │ External │
   │Controller│  │  entry  │                      │   repo   │   │   API    │
   └────┬────┘   └────┬────┘                      └────▲─────┘   └────▲─────┘
        │             │                                │              │
        │   gọi VÀO   │                          gọi RA│        gọi RA│
        ▼             ▼              ___                │              │
       ╱─────────────────────────────╲   ┌─────────┐  ╱│              │╲
      ╱        PORT trái (API)         ╲  │  Test   │ ╱ PORT phải (SPI) ╲
     ╱  ┌───────────────────────────┐  ╲ │ fixture │╱ ┌───────────────┐ ╲
    │   │                           │   ─┼─────────┼─ │               │  │
    │   │       APPLICATION         │    │ (cũng   │  │   port là     │  │
    │   │      (domain core)        │    │ driving)│  │  interface)   │  │
    │   │   use cases + entities    │    └─────────┘  │               │  │
    │   │                           │                 └───────────────┘  │
     ╲  └───────────────────────────┘                                   ╱
      ╲                                                                 ╱
       ╲───────────────────────────────────────────────────────────╱
              Hình lục giác = ranh giới giữa TRONG và NGOÀI
```

2. **Sơ đồ chiều-phụ-thuộc-đối-lại-luồng-điều-khiển** (phần phụ ở góc dưới phải của Uncle Bob trong _Clean Architecture_): hai mũi tên băng qua ranh giới — một _mũi tên nét liền_ cho luồng điều khiển (ví dụ Use Case → Presenter) và một _mũi tên nét đứt_ cho phụ thuộc mã nguồn trỏ về hướng ngược lại (Presenter → Output Port interface ← Use Case). Đây là sơ đồ quan trọng nhất cho mục tiêu học tập mà bạn đã nêu (xem lại mục 4.5).

3. **Củ hành đồng tâm** (Palermo / Martin): các vòng Entities → Use Cases → Interface Adapters → Frameworks, với một mũi tên một chiều dán nhãn "The Dependency Rule: source dependency chỉ trỏ vào trong."

```
        ┌───────────────────────────────────────────────┐
        │   Frameworks & Drivers (DB, Web, UI, devices)  │  ← vòng ngoài cùng
        │   ┌───────────────────────────────────────┐    │
        │   │      Interface Adapters               │    │
        │   │   (controllers, presenters, gateways) │    │
        │   │   ┌───────────────────────────────┐   │    │
        │   │   │       Use Cases               │   │    │
        │   │   │  (application business rules) │   │    │
        │   │   │   ┌───────────────────────┐   │   │    │
        │   │   │   │      Entities         │   │   │    │   ▲
        │   │   │   │ (enterprise biz rules)│   │   │    │   │ Dependency Rule:
        │   │   │   └───────────────────────┘   │   │    │   │ source dependency
        │   │   └───────────────────────────────┘   │    │   │ CHỈ trỏ VÀO TRONG
        │   └───────────────────────────────────────┘    │   │
        └───────────────────────────────────────────────┘
```

---

## Các khuyến nghị (Recommendations)

1. **Khi viết bài tiếng Việt, hãy dẫn dắt bằng mô hình tư duy hai-mũi-tên** (mục 4). Đó là trọng tâm khái niệm mà bạn đã hỏi và là điểm mà hầu hết các bài viết hoặc chôn vùi hoặc bỏ qua. Hãy trình bày một ví dụ TypeScript nơi hai mũi tên trùng nhau (phía driving) và một ví dụ nơi chúng ngược nhau (phía driven, với DIP).

2. **Hãy dùng từ vựng gốc của Cockburn trước**, rồi mới giới thiệu các từ đồng nghĩa. Cụ thể: `driving / driven` (Cockburn 2015), hoặc `primary / secondary` (Cockburn 2005), và chỉ sau đó mới nhắc tới các từ thay thế là `inbound / outbound`, `incoming / outgoing` (Hombergs). Hãy lưu ý rằng tất cả những từ này đều là cùng một sự phân biệt dưới những cái tên khác nhau.

3. **Tổ chức code của ví dụ TypeScript theo quy ước ba gói của Hombergs**: `domain/`, `application/` (chứa `ports/` và các class use-case service), và `adapters/` (chia nhỏ thành `in/` và `out/`). Thêm một file `main.ts` ở cấp cao nhất để làm việc wiring (nối dây). Cấu trúc này phản chiếu một bố cục đã được chứng minh trên các dự án thật và có thể được ép buộc bằng `dependency-cruiser`.

4. **Minh họa khả năng kiểm thử một cách cụ thể** bằng cách viết một bài unit test cho use-case với một adapter in-memory, và một bài integration test với một adapter thật (ví dụ Testcontainers cho Postgres). Sự tương phản này bán được pattern còn tốt hơn bất kỳ lời văn nào.

5. **Phân giai đoạn cho lời khuyên về việc áp dụng** dành cho độc giả tiếng Việt của bạn:
   - **Bắt đầu** với N-tier trên các dự án nhỏ/CRUD.
   - **Áp dụng hexagonal một cách có chọn lọc** khi hệ thống có hoặc là (a) một domain không tầm thường, hoặc (b) có hơn hai cách để được điều khiển (HTTP + CLI + queue), hoặc (c) có hơn một công nghệ lưu trữ khả dĩ trong suốt vòng đời của nó.
   - **Tái cấu trúc hướng tới hexagonal** khi bạn cảm thấy một trong hai nỗi đau — business logic rò rỉ hoặc code không kiểm thử được.
   - **Ngưỡng để khuyến nghị thay đổi**: nếu bạn có một REST controller duy nhất gọi một ORM duy nhất, bạn không cần nó. Nếu bạn có ≥2 driving adapter hoặc ≥2 driven adapter (hiện tại hoặc dự kiến), thì bạn cần.

6. **Trích dẫn các nguồn kinh điển** trong bài viết tiếng Việt, tất cả đều có sẵn miễn phí: bài viết 2005 của Cockburn, các Phần 1–3 năm 2008 của Palermo, bài đăng 2012 của Martin, case study ngày 10 tháng 3 năm 2020 của Netflix (Svrtan & Makagon), và cuốn sách Packt của Hombergs (ấn bản 1 năm 2019; ấn bản 2 năm 2023). Hãy tránh trích dẫn hàng chục bài viết trên Medium chỉ diễn giải lại mà không bổ sung được hiểu biết gì mới.

7. **Hãy chỉ ra điều mà hexagonal _không_ quy định**: phần bên trong hình lục giác. Đây là nơi DDD (entities, value objects, aggregates) lấp đầy khoảng trống một cách tự nhiên cho các domain phức tạp, nhưng pattern vẫn cho phép các cấu trúc bên trong đơn giản hơn đối với các domain đơn giản hơn.

---

## Các điểm cần lưu ý / cảnh báo (Caveats)

- Từ "**layer**" (lớp/tầng) chính xác không hề xuất hiện trong bài viết 2005 của Cockburn — những bài mô tả Hexagonal Architecture như "một dạng kiến trúc phân tầng" đang áp đặt một khung nhìn mà chính tác giả gốc bác bỏ. Chỉ có _bên trong_ và _bên ngoài_.

- "**Primary / secondary / driving / driven / inbound / outbound / incoming / outgoing**" là sáu cặp từ chỉ hai khái niệm. Các nguồn khác nhau; hãy lường trước sự va chạm khi pha trộn các tài liệu tham khảo. Cockburn dùng _primary / secondary_ năm 2005 và chuyển sang _driver / driven_ vào năm 2015.

- **Hexagonal ≠ Onion ≠ Clean** ở mức độ chi tiết, mặc dù chúng chia sẻ cùng một ý tưởng hồn cốt. Nếu một bài hướng dẫn tiếng Việt gộp chúng làm một như thể giống hệt nhau thì sai; nếu nó coi chúng như những kiến trúc xa lạ với nhau thì cũng sai. Cách diễn đạt trung thực là "cùng một gia đình, khác nhau về mức độ chi tiết."

- Tuyên bố được lặp lại rộng rãi rằng **"Spotify báo cáo giảm 40% thời gian phát triển tính năng"** nhờ hexagonal architecture chỉ xuất hiện trong một bài viết Medium đơn lẻ (của tác giả Tushark-16bit) và thiếu bất kỳ nguồn nào từ blog kỹ thuật của Spotify — hãy coi đây là thông tin chưa được kiểm chứng. Ngược lại, **case study của Netflix** được xuất bản trên chính blog kỹ thuật của Netflix bởi các tác giả có tên (Svrtan & Makagon) và là một nguồn vững chắc.

- **Hiệu năng**: Hexagonal Architecture thêm vào việc ánh xạ đối tượng/DTO và các lớp gián tiếp tại mỗi ranh giới. Với code nhạy cảm về độ trễ (giao dịch tần suất cao, hệ thống nhúng, game thời gian thực), pattern này có thể không phải là lựa chọn mặc định đúng đắn — wiki Metapatterns lưu ý rằng _"các interface chung chung giữa core và các adapter cản trở việc tối ưu hóa toàn hệ thống."_ Với các backend web/nghiệp vụ điển hình, chi phí phụ trội này là không đáng kể.

- **Frameworks**: Hầu hết các backend framework của TypeScript (NestJS, Express, Fastify, Hono) đều _ổn_ với hexagonal — chúng sống ở vòng ngoài với vai trò các driving adapter. Pattern chỉ rõ ràng chống lại những framework đòi hỏi phải là trung tâm (chẳng hạn những ORM nặng nề muốn domain của bạn phải kế thừa các lớp cơ sở của chúng).

- **Các nhãn "Domain Services" và "Application Services" của Onion** thường được gán cho Palermo thực ra _không_ nằm trong các bài viết gốc năm 2008 của ông. Palermo chỉ đặt tên cho Domain Model, các repository interface, application core (thuật ngữ tập thể), và lớp ngoài cùng UI / Infrastructure / Tests. Các tên vòng chi tiết hơn đi vào kho tàng kiến thức chung thông qua những người diễn giải về sau.

- Phần trình bày gốc của Hexagonal Architecture trên **c2 wiki (Portland Pattern Repository)** không có dấu thời gian nhìn thấy được, đó là lý do tại sao chính Cockburn cũng chỉ có thể ước lượng năm của bài viết sớm nhất của ông (ông xác định là "vào khoảng năm 2004").

---

_Tài liệu này được dịch toàn văn từ bản nghiên cứu tiếng Anh. Các thuật ngữ chuyên ngành được giữ nguyên tiếng Anh kèm giải thích tiếng Việt trong ngoặc đơn theo đúng quy ước đã thống nhất. Ba sơ đồ ASCII được bổ sung để minh họa kiến trúc tổng thể, chiều phụ thuộc đối lại chiều luồng điều khiển, và mô hình củ hành đồng tâm._
