import React from 'react'
import BigButton from './BigButton'
import Image from 'next/image'

export default function Hero() {
  return (
    <div className='flex flex-col items-center gap-10 
    sm:gap-20
    tablet:gap-20
    laptop-l:mx-20 
    '>
        <div className='flex flex-col items-center gap-10
        tablet:mx-12
        desktop:gap-6
        '>
          <h1 className='text-black font-bold text-5xl text-center 
          sm:text-[84px] mt-10
          tablet:text-[80px] tablet:mt-5 
          laptop:text-[80px] laptop:leading-[120px] laptop:mt-0
          laptop-l:text-[100px] laptop-l:leading-[120px] laptop-l:mt-0
          desktop:text-[130px] desktop:leading-[180px] desktop:mx-80
          '>Here your choices matter.</h1>
          <BigButton label="Check our games" link='/' className=''/>
        </div>
        <Image
            className='laptop:h-[500px] laptop:w-[500px] desktop:h-[1000px] desktop:w-[1000px]'
            src={"/images/hero-image.svg"}
            width={300}
            height={300}
            alt='gameplay freedom'
            priority={true}
        />
    </div>
  )
}
