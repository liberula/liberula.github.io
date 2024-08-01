import React from 'react'
import YellowTag from './YellowTag'

export default function LatestRelease() {
  return (
    <div className='flex flex-col items-center -mt-10 desktop:-mt-20'>
        <YellowTag label = "Latest Release"/>
        <div className="aspect-w-[4/5] aspect-h-9 w-full h-full laptop-l:w-4/5">
            <iframe className="w-full h-full" src="https://www.youtube.com/embed/1AyNbM9UYVg?si=mBt0HVC9qTAMr8y-" title="YouTube video player" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen></iframe>
        </div>
    </div>
  )
}
