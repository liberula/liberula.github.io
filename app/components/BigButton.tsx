import React from 'react'
import Link from 'next/link'


  

interface BigButtonProps  {
    label : string,
    link : string,
    className? : string
}

export default function BigButton({label, link, className = ""}:BigButtonProps) {
  var classNameString:string = `bg-black text-white py-4 px-2 text-center text-3xl font-bold italic shadow-md
    mobile-s:text-[28px]
    sm:text-5xl
    tablet:text-[40px] tablet:px-6 tablet:py-6
    laptop-l:text-5xl laptop-l:px-14 laptop-l:py-6
    desktop:text-6xl desktop:px-[90px] desktop:py-[60px] desktop:shadow-xl
    `
    classNameString = classNameString.concat(className)
  return (
    <button className={classNameString}>
        <Link href={link} >
            {label.toUpperCase()}
        </Link> 
    </button>

  )
}
