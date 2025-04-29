import { IonButton } from '@ionic/core/components/ion-button';
import { IonToast } from '@ionic/core/components/ion-toast';

let baseUrl = "https://dae-mobile-assignment.hkit.cc/api";

// DOM 元素
const refreshButton = document.querySelector('#refreshButton') as HTMLIonButtonElement;
const errorToast = document.querySelector('#errorToast') as HTMLIonToastElement;
const successToast = document.querySelector('#successToast') as HTMLIonToastElement;
const hardwareSlides = document.querySelector('#hardwareSlides') as HTMLElement;
const prevPageButton = document.querySelector('#prevPage') as HTMLIonButtonElement;
const nextPageButton = document.querySelector('#nextPage') as HTMLIonButtonElement;
const logoutButton = document.querySelector('#logoutButton') as HTMLIonButtonElement;
const loader = document.querySelector('#loader') as HTMLElement;
const searchInput = document.querySelector('#searchInput') as HTMLIonInputElement | null;
const searchButton = document.querySelector('#searchButton') as HTMLIonButtonElement;
const clearSearchButton = document.querySelector('#clearSearchButton') as HTMLIonButtonElement;
const categorySelect = document.querySelector('#categorySelect') as HTMLIonSelectElement | null;
const sortSelect = document.querySelector('#sortSelect') as HTMLIonSelectElement | null;
const toggleBookmarksButton = document.querySelector('#toggleBookmarksButton') as HTMLIonButtonElement;

// 分頁與過濾變數
let currentPage = 1;
let totalPages = 1;
let bookmarkedItems: number[] = [];
let isLoading = false;
let searchQuery: string | null = null;
let categoryFilter: string | null = null;
let sortField: string | null = 'published_at';
let sortOrder: string | null = 'desc';
let isBookmarksLoaded = false;
let showBookmarksOnly: boolean = false;

// Skeleton 模板
const skeletonSlide = document.createElement('ion-slide');
skeletonSlide.innerHTML = `
  <ion-card>
    <ion-card-header>
      <ion-card-title>
        <ion-skeleton-text animated style="width: 80%;"></ion-skeleton-text>
      </ion-card-title>
    </ion-card-header>
    <ion-card-content>
      <p><ion-skeleton-text animated style="width: 60%;"></ion-skeleton-text></p>
      <p><ion-skeleton-text animated style="width: 30%;"></ion-skeleton-text></p>
    </ion-card-content>
  </ion-card>
`;

// 書籤功能
async function bookmarkItem(item_id: number, icon: HTMLIonIconElement) {
  const token = localStorage.getItem('token') || '';
  try {
    const res = await fetch(`${baseUrl}/bookmarks/${item_id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (json.error) {
      throw new Error(json.error);
    }
    successToast.message = json.message === 'newly bookmarked' ? '已添加書籤' : '書籤已存在';
    successToast.present();
    if (json.message === 'newly bookmarked') {
      bookmarkedItems.push(item_id);
      icon.classList.add('bookmarked');
      icon.name = 'bookmark';
      if (showBookmarksOnly) {
        currentPage = 1;
        loadItems();
      }
    }
  } catch (error) {
    errorToast.message = `添加書籤失敗：${error}`;
    errorToast.present();
  }
}

async function unBookmarkItem(item_id: number, icon: HTMLIonIconElement) {
  const token = localStorage.getItem('token') || '';
  try {
    const res = await fetch(`${baseUrl}/bookmarks/${item_id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (json.error) {
      throw new Error(json.error);
    }
    successToast.message = json.message === 'newly deleted' ? '已移除書籤' : '書籤已移除';
    successToast.present();
    if (json.message === 'newly deleted') {
      bookmarkedItems = bookmarkedItems.filter(id => id !== item_id);
      icon.classList.remove('bookmarked');
      icon.name = 'bookmark-outline';
      if (showBookmarksOnly) {
        currentPage = 1;
        loadItems();
      }
    }
  } catch (error) {
    errorToast.message = `移除書籤失敗：${error}`;
    errorToast.present();
  }
}

async function getBookmarkItems() {
  const token = localStorage.getItem('token') || '';
  console.log('Fetching bookmarks with token:', token.substring(0, 10) + '...');
  try {
    const res = await fetch(`${baseUrl}/bookmarks`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log('Bookmarks response status:', res.status);
    const json = await res.json();
    console.log('Bookmarks response:', json);
    if (json.error) {
      throw new Error(json.error);
    }
    isBookmarksLoaded = true;
    return json.item_ids as number[];
  } catch (error) {
    console.error('Get bookmarks error:', error);
    errorToast.message = `獲取書籤失敗：${error}`;
    errorToast.present();
    return [];
  }
}

async function autoRetryGetBookmarks() {
  let error = null;
  for (let i = 0; i < 3; i++) {
    try {
      const itemIds = await getBookmarkItems();
      return itemIds;
    } catch (err) {
      error = err;
      console.error('Retry get bookmarks:', err);
    }
  }
  console.error('All retries failed:', error);
  return [];
}

// 獲取類別列表
async function getCategories() {
  const token = localStorage.getItem('token') || '';
  try {
    const res = await fetch(`${baseUrl}/hardware?page=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error(`服務器返回 ${res.status}`);
    }
    const json = await res.json();
    if (json.error) {
      throw new Error(json.error);
    }
    const categories = Array.from(
      new Set(json.items.map((item: any) => item.category))
    ) as string[];
    return categories;
  } catch (error) {
    console.error('Get categories error:', error);
    errorToast.message = `獲取類別失敗：${error}`;
    errorToast.present();
    return [];
  }
}

// 填充類別選擇框
async function populateCategories() {
  if (!categorySelect) {
    console.error('Category select not found');
    return;
  }
  const categories = await getCategories();
  categorySelect.innerHTML = `
    <ion-select-option value="">全部</ion-select-option>
    ${categories.map(category => `<ion-select-option value="${category}">${category}</ion-select-option>`).join('')}
  `;
}

// 檢查登入狀態
async function checkAuth() {
  const token = localStorage.getItem('token') || '';
  console.log('Token from localStorage:', token);
  if (!token) {
    console.log('No token found, redirecting to login');
    window.location.href = 'login.html';
    return false;
  }

  let error = null;
  for (let i = 0; i < 3; i++) {
    try {
      console.log('Checking auth with token:', token.substring(0, 10) + '...');
      const res = await fetch(`${baseUrl}/auth/check`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('Auth check status:', res.status);

      if (!res.ok) {
        const text = await res.text();
        console.error('Auth check response:', text);
        errorToast.message = `認證失敗，服務器返回 ${res.status}: ${text}`;
        errorToast.present();
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem('token');
          localStorage.removeItem('username');
          window.location.href = 'login.html';
          return false;
        }
        continue;
      }

      const json = await res.json();
      console.log('Auth check JSON:', json);
      if (!json.user_id) {
        console.log('Invalid user_id, redirecting to login');
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        window.location.href = 'login.html';
        return false;
      }

      return true;
    } catch (err) {
      error = err;
      console.error('Check auth error, retrying:', err);
    }
  }

  console.error('All retries failed:', error);
  errorToast.message = '認證失敗，請檢查網絡或稍後再試';
  errorToast.present();
  return false;
}

// 提取 YouTube 影片 ID
function getYouTubeVideoId(url: string): string | null {
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

// 渲染產品到 UI
function renderItems(items: any[], append: boolean = false) {
  if (!append) {
    hardwareSlides.textContent = '';
  }
  for (let item of items) {
    let slide = document.createElement('ion-slide');
    let card = document.createElement('ion-card');

    let videoHtml = '';
    if (item.videoUrl) {
      const videoId = getYouTubeVideoId(item.videoUrl);
      if (videoId) {
        videoHtml = `<iframe class="item-video" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
      } else if (item.videoUrl.endsWith('.mp4') || item.videoUrl.endsWith('.webm') || item.videoUrl.endsWith('.ogg')) {
        videoHtml = `<video class="item-video" controls><source src="${item.videoUrl}" type="video/${item.videoUrl.split('.').pop()}"></video>`;
      }
    }

    const isBookmarked = bookmarkedItems.includes(item.id);
    card.innerHTML = `
      <img class="item-image" src="${item.imageUrl}" alt="${item.title}" />
      ${videoHtml}
      <ion-card-header>
        <ion-card-title class="item-title">${item.title}</ion-card-title>
        <ion-icon class="bookmark-button${isBookmarked ? ' bookmarked' : ''}" name="${isBookmarked ? 'bookmark' : 'bookmark-outline'}" data-item-id="${item.id}"></ion-icon>
      </ion-card-header>
      <ion-card-content class="card-content">
        <p class="item-description">${item.details}</p>
        <p class="item-subtitle">類別：${item.category}</p>
        <p class="item-subtitle">組件：${item.language}</p>
        <p class="item-subtitle">發布日期：${new Date(item.date).toLocaleDateString()}</p>
        <div class="tag-container">
          ${item.tags.map((tag: string) => `<ion-chip>${tag}</ion-chip>`).join('')}
        </div>
      </ion-card-content>
    `;
    slide.appendChild(card);
    hardwareSlides.appendChild(slide);

    const bookmarkIcon = card.querySelector('.bookmark-button') as HTMLIonIconElement;
    bookmarkIcon.addEventListener('click', () => {
      const itemId = parseInt(bookmarkIcon.getAttribute('data-item-id') || '0');
      if (isBookmarked) {
        unBookmarkItem(itemId, bookmarkIcon);
      } else {
        bookmarkItem(itemId, bookmarkIcon);
      }
    });
  }
}

// 更新分頁按鈕狀態
function updatePaginationButtons() {
  prevPageButton.disabled = currentPage === 1;
  nextPageButton.disabled = currentPage >= totalPages;
}

// 登出
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  window.location.href = 'login.html';
}

// 加載產品數據
async function loadItems(append: boolean = false) {
  if (isLoading || (append && currentPage >= totalPages)) {
    return;
  }

  isLoading = true;
  console.log('Loading items...', { page: currentPage, append, search: searchQuery, category: categoryFilter, sort: sortField, order: sortOrder, bookmarksOnly: showBookmarksOnly, bookmarkedItems });
  if (!append) {
    hardwareSlides.textContent = '';
    hardwareSlides.appendChild(skeletonSlide.cloneNode(true));
    hardwareSlides.appendChild(skeletonSlide.cloneNode(true));
    hardwareSlides.appendChild(skeletonSlide.cloneNode(true));
  } else {
    loader.style.display = 'block';
  }

  const token = localStorage.getItem('token') || '';
  if (!token) {
    hardwareSlides.textContent = '';
    errorToast.message = '請登入以查看產品';
    errorToast.present();
    window.location.href = 'login.html';
    isLoading = false;
    loader.style.display = 'none';
    return;
  }

  try {
    if (!append && !isBookmarksLoaded) {
      bookmarkedItems = await autoRetryGetBookmarks();
    }

    // 若無收藏項目且啟用收藏模式，提前返回
    if (showBookmarksOnly && bookmarkedItems.length === 0) {
      hardwareSlides.textContent = '';
      errorToast.message = '尚未收藏任何項目';
      errorToast.present();
      isLoading = false;
      loader.style.display = 'none';
      updatePaginationButtons();
      return;
    }

    let params = new URLSearchParams();
    params.set('page', currentPage.toString());
    if (searchQuery) {
      params.set('search', searchQuery);
    }
    if (categoryFilter) {
      params.set('category', categoryFilter);
    }
    if (sortField && sortOrder) {
      params.set('sort', sortField);
      params.set('order', sortOrder);
    }
    if (showBookmarksOnly && bookmarkedItems.length > 0) {
      params.set('ids', bookmarkedItems.join(','));
    }

    console.log('Fetch URL:', `${baseUrl}/hardware?${params}`);
    let res = await fetch(`${baseUrl}/hardware?${params}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const text = await res.text();
      console.error('Hardware response:', text);
      errorToast.message = `加載產品失敗，服務器返回 ${res.status}`;
      errorToast.present();
      isLoading = false;
      loader.style.display = 'none';
      return;
    }

    let json = await res.json();
    if (json.error) {
      console.error('API error:', json.error);
      errorToast.message = json.error;
      errorToast.present();
      hardwareSlides.textContent = '';
      isLoading = false;
      loader.style.display = 'none';
      return;
    }

    type ServerItem = {
      id: number;
      tags: string[];
      license: string;
      schematic_url: string;
      manufacturer: string;
      title: string;
      description: string;
      category: string;
      image_url: string;
      video_url: string;
      published_at: string;
      components: string[];
    };

    let serverItems = json.items as ServerItem[];
    let uiItems = serverItems.map((item: ServerItem) => {
      return {
        id: item.id,
        title: item.title,
        language: item.components.join(', '),
        details: item.description,
        category: item.category,
        tags: item.tags,
        imageUrl: item.image_url,
        videoUrl: item.video_url,
        date: item.published_at,
      };
    });

    // 客戶端過濾，確保僅顯示收藏項目
    uiItems = uiItems.filter(item => !showBookmarksOnly || bookmarkedItems.includes(item.id));

    totalPages = Math.ceil(json.pagination.total / json.pagination.limit);
    console.log('Pagination:', { currentPage, totalPages, items: uiItems });

    renderItems(uiItems, append);
    updatePaginationButtons();
    if (uiItems.length === 0 && !append) {
      errorToast.message = showBookmarksOnly && bookmarkedItems.length === 0 ? '尚未收藏任何項目' : '未找到匹配的產品';
      errorToast.present();
    }
    currentPage++;
  } catch (error) {
    console.error('Fetch error:', error);
    errorToast.message = '無法加載產品，請稍後再試';
    errorToast.present();
    hardwareSlides.textContent = '';
  } finally {
    isLoading = false;
    loader.style.display = 'none';
  }
}

// 無限捲動監聽
function setupInfiniteScroll() {
  window.addEventListener('scroll', () => {
    if (
      !isLoading &&
      window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 100
    ) {
      console.log('Reached bottom, loading next page');
      loadItems(true);
    }
  });
}

// 搜尋、過濾與排序功能
function setupSearchFilterAndSort() {
  if (!searchInput || !searchButton || !clearSearchButton || !categorySelect || !sortSelect || !toggleBookmarksButton) {
    console.error('Search, filter, sort, or bookmarks button elements not found');
    errorToast.message = '搜尋、過濾、排序或收藏功能初始化失敗';
    errorToast.present();
    return;
  }

  searchButton.addEventListener('click', () => {
    const query = searchInput.value ? String(searchInput.value).trim() : '';
    searchQuery = query || null;
    currentPage = 1;
    console.log('Search initiated:', { query: searchQuery, category: categoryFilter, sort: sortField, order: sortOrder, bookmarksOnly: showBookmarksOnly });
    loadItems();
  });

  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const query = searchInput.value ? String(searchInput.value).trim() : '';
      searchQuery = query || null;
      currentPage = 1;
      console.log('Search initiated via Enter:', { query: searchQuery, category: categoryFilter, sort: sortField, order: sortOrder, bookmarksOnly: showBookmarksOnly });
      loadItems();
    }
  });

  categorySelect.addEventListener('ionChange', (e: CustomEvent) => {
    categoryFilter = e.detail.value || null;
    currentPage = 1;
    console.log('Category filter changed:', { category: categoryFilter, query: searchQuery, sort: sortField, order: sortOrder, bookmarksOnly: showBookmarksOnly });
    loadItems();
  });

  sortSelect.addEventListener('ionChange', (e: CustomEvent) => {
    const [field, order] = e.detail.value.split('-');
    sortField = field || null;
    sortOrder = order || null;
    currentPage = 1;
    console.log('Sort changed:', { sort: sortField, order: sortOrder, query: searchQuery, category: categoryFilter, bookmarksOnly: showBookmarksOnly });
    loadItems();
  });

  toggleBookmarksButton.addEventListener('click', () => {
    showBookmarksOnly = !showBookmarksOnly;
    toggleBookmarksButton.textContent = showBookmarksOnly ? '顯示所有' : '只顯示收藏';
    toggleBookmarksButton.setAttribute('aria-pressed', showBookmarksOnly.toString());
    currentPage = 1;
    console.log('Bookmarks filter toggled:', { bookmarksOnly: showBookmarksOnly, query: searchQuery, category: categoryFilter, sort: sortField, order: sortOrder });
    loadItems();
  });

  clearSearchButton.addEventListener('click', () => {
    if (searchInput) {
      searchInput.value = '';
    }
    if (categorySelect) {
      categorySelect.value = '';
    }
    if (sortSelect) {
      sortSelect.value = 'published_at-desc';
    }
    searchQuery = null;
    categoryFilter = null;
    sortField = 'published_at';
    sortOrder = 'desc';
    showBookmarksOnly = false;
    toggleBookmarksButton.textContent = '只顯示收藏';
    toggleBookmarksButton.setAttribute('aria-pressed', 'false');
    currentPage = 1;
    console.log('Search, filter, sort, and bookmarks cleared');
    loadItems();
  });
}

// 初始化分頁按鈕事件
function setupPagination() {
  prevPageButton?.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      loadItems();
    }
  });

  nextPageButton?.addEventListener('click', () => {
    if (currentPage < totalPages) {
      currentPage++;
      loadItems();
    }
  });
}

// 初始化
if (
  refreshButton &&
  errorToast &&
  successToast &&
  hardwareSlides &&
  prevPageButton &&
  nextPageButton &&
  logoutButton &&
  loader &&
  searchInput &&
  searchButton &&
  clearSearchButton &&
  categorySelect &&
  sortSelect &&
  toggleBookmarksButton
) {
  refreshButton.addEventListener('click', () => loadItems());
  logoutButton.addEventListener('click', logout);
  setupPagination();
  setupInfiniteScroll();
  setupSearchFilterAndSort();
  checkAuth().then(async (isAuthenticated) => {
    if (isAuthenticated) {
      console.log('Authentication successful, loading items');
      await populateCategories();
      bookmarkedItems = await autoRetryGetBookmarks();
      loadItems();
    } else {
      console.log('Authentication failed, redirected to login');
    }
  });
} else {
  console.error('Required DOM elements are missing');
  errorToast.message = '頁面初始化失敗';
  errorToast.present();
}