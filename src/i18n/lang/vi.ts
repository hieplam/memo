import type { UIStrings } from "../types";

export default {
  nav: {
    home: "Trang chủ",
    posts: "Bài viết",
    tags: "Thẻ",
    about: "Giới thiệu",
    archives: "Lưu trữ",
    search: "Tìm kiếm",
  },
  post: {
    publishedAt: "Đăng lúc",
    updatedAt: "Cập nhật",
    sharePostIntro: "Chia sẻ bài viết:",
    sharePostOn: "Chia sẻ bài viết trên {{platform}}",
    sharePostViaEmail: "Chia sẻ bài viết qua email",
    tagLabel: "Thẻ",
    backToTop: "Lên đầu trang",
    goBack: "Quay lại",
    editPage: "Chỉnh sửa trang",
    previousPost: "Bài trước",
    nextPost: "Bài sau",
    keepReading: "Đọc tiếp",
    keepReadingDesc: "Vài bài viết khác cùng mạch.",
    subscribePrompt: "Muốn đọc lúc rảnh hơn?",
    subscribeCta: "Đăng ký qua RSS",
  },
  pagination: {
    prev: "Trước",
    next: "Sau",
    page: "Trang",
  },
  home: {
    socialLinks: "Mạng xã hội",
    featured: "Nổi bật",
    recentPosts: "Bài viết gần đây",
    allPosts: "Tất cả bài viết",
  },
  footer: {
    copyright: "Bản quyền",
    allRightsReserved: "Bảo lưu mọi quyền.",
  },
  pages: {
    tagTitle: "Thẻ",
    tagDesc: "Tất cả bài viết có thẻ",

    tagsTitle: "Thẻ",
    tagsDesc: "Tất cả các thẻ được dùng trong bài viết.",

    postsTitle: "Bài viết",
    postsDesc: "Tất cả bài viết tôi đã đăng.",

    archivesTitle: "Lưu trữ",
    archivesDesc: "Tất cả bài viết tôi đã lưu trữ.",

    searchTitle: "Tìm kiếm",
    searchDesc: "Tìm bất kỳ bài viết nào ...",
  },
  a11y: {
    skipToContent: "Bỏ qua, đến nội dung chính",
    openMenu: "Mở menu",
    closeMenu: "Đóng menu",
    toggleTheme: "Đổi giao diện sáng/tối",
    searchPlaceholder: "Tìm bài viết...",
    noResults: "Không tìm thấy kết quả",
    goToPreviousPage: "Đến trang trước",
    goToNextPage: "Đến trang sau",
  },
  notFound: {
    title: "404 Không tìm thấy",
    message: "Không tìm thấy trang",
    goHome: "Về trang chủ",
  },
} satisfies UIStrings;
