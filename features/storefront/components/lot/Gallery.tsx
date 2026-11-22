'use client'
import { useState } from 'react'

export function Gallery({ images, title }: { images: Array<{ url: string; caption: string }>; title: string }) {
  const [i, setI] = useState(0)
  const current = images[i] ?? images[0]
  return (
    <div>
      <div className="ar-gallery-main">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={current.url} alt={current.caption || `Photo ${i + 1} of ${title}`} />
      </div>
      {images.length > 1 ? (
        <div className="ar-thumbs" role="group" aria-label="Photos">
          {images.map((img, n) => (
            <button key={img.url + n} type="button" aria-pressed={n === i} aria-label={`Photo ${n + 1}`} onClick={() => setI(n)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
