import React from 'react'

interface YellowTagProps{
    label : string,
    className? : string
}

export default function YellowTag({label, className = ""} : YellowTagProps) {
    var classNameString : string = `bg-liberula-yellow text-black py-4 px-2 text-center text-3xl font-bold  shadow-md grow-0 
    mobile-s:text-[28px]
    sm:text-5xl
    tablet:text-[40px] tablet:px-6 tablet:py-6
    laptop-l:text-6xl laptop-l:px-14 laptop-l:py-10
    desktop:text-7xl desktop:px-[90px] desktop:py-[60px] desktop:shadow-xl`
    classNameString = classNameString?.concat(className)
  return (
    <div className={classNameString}>
        {label}
    </div>
  )
}
