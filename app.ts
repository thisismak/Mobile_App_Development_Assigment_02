import { IonLoadingCustomEvent } from '@ionic/core';
import { IonButton } from '@ionic/core/components/ion-button'
import { IonToast } from '@ionic/core/components/ion-toast'
import { IonList } from '@ionic/core/components/ion-list'

let baseUrl = "https://dae-mobile-assignment.hkit.cc/api";

declare var refreshButton: IonButton
refreshButton?.addEventListener('click', loadItems)

declare var errorToast: IonToast

declare var courseList: IonList

let skeletonItem = courseList.querySelector('.skeleton-item')!
skeletonItem.remove()

async function loadItems() {
    console.log('loading items...')
    courseList.textContent = ''
    courseList.appendChild(skeletonItem.cloneNode(true))
    courseList.appendChild(skeletonItem.cloneNode(true))
    courseList.appendChild(skeletonItem.cloneNode(true))
    
    let token = ''
    let res = await fetch(`${baseUrl}/hardware`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
    })
    
    let json = await res.json()
    if (json.error) {
        errorToast.message = json.error
        errorToast.present()
        courseList.textContent = ''
        return
    }
    
    type ServerItem = {
        id: number
        tags: string[]
        license: string
        schematic_url: string
        manufacturer: string
        title: string
        description: string
        category: string
        image_url: string
        video_url: string
        published_at: string
        components: string[]
    }
    
    let serverItems = json.items as ServerItem[]
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
        }
    })
    
    console.log('items:', uiItems)
    courseList.textContent = ''
    
    for (let item of uiItems) {
        let card = document.createElement('ion-card')
        card.innerHTML = `
        <ion-card-header>
            <ion-card-title>${item.title}</ion-card-title>
        </ion-card-header>
        <ion-card-content>
            <p>${item.details}</p>
            <p>類別：${item.category}</p>
            <p>組件：${item.language}</p>
            <p>發布日期：${new Date(item.date).toLocaleDateString()}</p>
        </ion-card-content>
        `
        courseList.appendChild(card)
    }
}

loadItems()