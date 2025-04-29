import { IonButton } from '@ionic/core/components/ion-button';
import { IonToast } from '@ionic/core/components/ion-toast';

let baseUrl = "https://dae-mobile-assignment.hkit.cc/api";

// DOM 元素
const refreshButton = document.querySelector('#refreshButton') as HTMLIonButtonElement;
const errorToast = document.querySelector('#errorToast') as HTMLIonToastElement;
const hardwareSlides = document.querySelector('#hardwareSlides') as HTMLElement;
const prevPageButton = document.querySelector('#prevPage') as HTMLIonButtonElement;
const nextPageButton = document.querySelector('#nextPage') as HTMLIonButtonElement;

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

// 渲染產品到 UI
function renderItems(items: any[]) {
  hardwareSlides.textContent = '';
  for (let item of items) {
    let slide = document.createElement('ion-slide');
    let card = document.createElement('ion-card');
    card.innerHTML = `
      <img class="item-image" src="${item.imageUrl}" alt="${item.title}" />
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

// 加載產品數據
async function loadItems() {
  console.log('loading items...', { page: currentPage });
  hardwareSlides.textContent = '';
  hardwareSlides.appendChild(skeletonSlide.cloneNode(true));
  hardwareSlides.appendChild(skeletonSlide.cloneNode(true));
  hardwareSlides.appendChild(skeletonSlide.cloneNode(true));

  let token = localStorage.getItem('token') || '';
  try {
    let params = new URLSearchParams();
    params.set('page', currentPage.toString());
    let res = await fetch(`${baseUrl}/hardware?${params}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
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

    // 更新總頁數
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
if (refreshButton && errorToast && hardwareSlides && prevPageButton && nextPageButton) {
  refreshButton.addEventListener('click', loadItems);
  setupPagination();
  loadItems();
} else {
  console.error('Required DOM elements are missing');
  errorToast.message = '頁面初始化失敗';
  errorToast.present();
}