export async function bookmarkItem(item_id: number) {
    try {
        let res = await fetch(`${baseUrl}/bookmarks/${item_id}`, {
            method: 'POST',
            headers: ( Authorization: `Bearer ${token}`),
        })
        let json = await res.json()
        
    }
}