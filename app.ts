import { IonButton } from '@ionic/core/components/ion-button';
import { IonToast } from '@ionic/core/components/ion-toast';

let baseUrl = "https://dae-mobile-assignment.hkit.cc/api";

// DOM 元素
const refreshButton = document.querySelector('#refreshButton') as HTMLIonButtonElement;
const errorToast = document.querySelector('#errorToast') as HTMLIonToastElement;
const hardwareSlides = document.querySelector('#hardwareSlides') as HTMLElement;
const prevPageButton = document.querySelector('#prevPage') as HTMLIonButtonElement;
const nextPageButton = document.querySelector('#nextPage') as HTMLIonButtonElement;
const logoutButton = document.querySelector('#logoutButton') as HTMLIonButtonElement;

// 分頁變數
let currentPage = 1;
let totalPages = 1;

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

// 提取 YouTube 影片 ID
function getYouTubeVideoId(url: string): string | null {
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

// 渲染產品到 UI
function renderItems(items: any[]) {
  hardwareSlides.textContent = '';
  for (let item of items) {
    let slide = document.createElement('ion-slide');
    let card = document.createElement('ion-card');

    // 處理影片播放器
    let videoHtml = '';
    if (item.videoUrl) {
      const videoId = getYouTubeVideoId(item.videoUrl);
      if (videoId) {
        videoHtml = `<iframe class="item-video" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
      } else if (item.videoUrl.endsWith('.mp4') || item.videoUrl.endsWith('.webm') || item.videoUrl.endsWith('.ogg')) {
        videoHtml = `<video class="item-video" controls><source src="${item.videoUrl}" type="video/${item.videoUrl.split('.').pop()}"></video>`;
      }
    }

    card.innerHTML = `
      <img class="item-image" src="${item.imageUrl}" alt="${item.title}" />
      ${videoHtml}
      <ion-card-header>
        <ion-card-title class="item-title">${item.title}</ion-card-title>
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
  }
}

// 更新分頁按鈕狀態
function updatePaginationButtons() {
  prevPageButton.disabled = currentPage === 1;
  nextPageButton.disabled = currentPage === totalPages;
}

// 統一錯誤處理
function handleApiError(message: string, error?: any) {
  console.error(message, error);
  errorToast.message = message;
  errorToast.present();
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  setTimeout(() => {
    window.location.href = 'login.html';
  }, 2000); // 延遲 2 秒，讓用戶看到提示
}

// 檢查登入狀態（帶重試機制）
async function checkAuth(retryCount = 3, retryDelay = 1000): Promise<boolean> {
  const token = localStorage.getItem('token') || '';
  if (!token) {
    console.log('No token found, redirecting to login');
    handleApiError('請先登錄');
    return false;
  }

  for (let attempt = 1; attempt <= retryCount; attempt++) {
    try {
      console.log(`Checking auth with token (attempt ${attempt}/${retryCount}):`, token.substring(0, 10) + '...');
      const res = await fetch(`${baseUrl}/auth/check`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });

      const text = await res.text(); // 先獲取原始響應
      console.log(`Auth check raw response (attempt ${attempt}):`, text);

      if (!res.ok) {
        console.error(`Auth check failed with status (attempt ${attempt}):`, res.status, 'Response:', text);
        const json = text ? JSON.parse(text) : {};
        if (res.status === 401) {
          handleApiError('登錄憑證無效或已過期，請重新登錄');
          return false;
        } else if (res.status === 500 && attempt < retryCount) {
          console.log(`Retrying auth check after ${retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue; // 重試
        } else {
          handleApiError(`認證失敗，服務器錯誤 (${res.status})：${json.error || '請稍後再試'}`);
          return false;
        }
      }

      const json = JSON.parse(text); // 手動解析 JSON
      console.log(`Auth check parsed result (attempt ${attempt}):`, json);

      if (!json.user_id) {
        console.log('Invalid user_id, redirecting to login');
        handleApiError('無效的用戶 ID，請重新登錄');
        return false;
      }

      return true; // 認證成功
    } catch (error) {
      console.error(`Check auth error (attempt ${attempt}):`, error);
      if (attempt < retryCount) {
        console.log(`Retrying auth check after ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue; // 重試
      }
      handleApiError('認證失敗，請檢查網絡或稍後再試', error);
      return false;
    }
  }

  return false; // 所有重試均失敗
}

// 登出
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  window.location.href = 'login.html';
}

// 加載產品數據
async function loadItems() {
  console.log('loading items...', { page: currentPage });
  hardwareSlides.textContent = '';
  hardwareSlides.appendChild(skeletonSlide.cloneNode(true));
  hardwareSlides.appendChild(skeletonSlide.cloneNode(true));
  hardwareSlides.appendChild(skeletonSlide.cloneNode(true));

  const token = localStorage.getItem('token') || '';
  if (!token) {
    hardwareSlides.textContent = '';
    handleApiError('請登入以查看產品');
    return;
  }

  try {
    let params = new URLSearchParams();
    params.set('page', currentPage.toString());
    let res = await fetch(`${baseUrl}/hardware?${params}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('Hardware response:', text);
      errorToast.message = `加載產品失敗，服務器返回 ${res.status}`;
      errorToast.present();
      return;
    }

    let json = await res.json();
    if (json.error) {
      console.error('API error:', json.error);
      errorToast.message = json.error;
      errorToast.present();
      hardwareSlides.textContent = '';
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

    totalPages = Math.ceil(json.pagination.total / json.pagination.limit);
    console.log('Pagination:', { currentPage, totalPages, items: uiItems });

    renderItems(uiItems);
    updatePaginationButtons();
  } catch (error) {
    console.error('Fetch error:', error);
    errorToast.message = '無法加載產品，請稍後再試';
    errorToast.present();
    hardwareSlides.textContent = '';
  }
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
if (refreshButton && errorToast && hardwareSlides && prevPageButton && nextPageButton && logoutButton) {
  refreshButton.addEventListener('click', loadItems);
  logoutButton.addEventListener('click', logout);
  setupPagination();
  document.addEventListener('DOMContentLoaded', () => {
    checkAuth().then((isAuthenticated) => {
      if (isAuthenticated) {
        console.log('Authentication successful, loading items');
        loadItems();
      } else {
        console.log('Authentication failed, redirected to login');
      }
    });
  });
} else {
  console.error('Required DOM elements are missing');
  errorToast.message = '頁面初始化失敗';
  errorToast.present();
}