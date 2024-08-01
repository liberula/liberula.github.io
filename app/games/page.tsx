import React from 'react'
import GamesCarrousel from '../components/GamesCarrousel'

export default function GamesPage() {
  return (
    <main className="flex flex-col stretch mb-10 items-center justify-center">
        <h1 className='text-black font-bold text-5xl text-center italic
        sm:text-[84px] mt-20 mb-52 tablet:mt-32
        tablet:text-[80px] 
        laptop:text-[80px] laptop:leading-[120px]
        laptop-l:text-[100px] laptop-l:leading-[120px] 
        desktop:text-[130px] desktop:leading-[180px] desktop:mt-40 desktop:mb-44
        '>OUR GAMES</h1>
        <GamesCarrousel/>
    </main>
  )
}
