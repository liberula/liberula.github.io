import React from 'react'
import BentoBox from './BentoBox'
import Image from 'next/image'
import Link from 'next/link'

interface FooterButtonProps{
    className? : string,
    icon_path : string
    center_text : string,
    bottom_text : string
    link:string
}

const FooterButtonElement = (props:FooterButtonProps) => {
    return(
        <Link href={props.link} className='align-middle  items-center flex-1'>
            <div className='flex flex-col align-middle items-center gap-8'>
                <div className='flex flex-col items-center align-middle'>
                    <Image
                        className='laptop-l:w-[140px] laptop-l:h-[140px] desktop:w-[170px] desktop:h-[170px]'
                        src={props.icon_path}
                        width={122}
                        height={122}
                        alt='icon'
                    />
                    <span className='text-black text-2xl laptop-l:text-3xl desktop:text-4xl font-bold text-center mx-4'>{props.center_text}</span>
                </div>
                <span className='text-black text-xl laptop-l:text-2xl desktop:text-3xl text-center italic '>{props.bottom_text}</span>
            </div>
        </Link>
    )
}

export default function FooterButton(props:FooterButtonProps) {
    var classNameString = `bg-white size-[280px] laptop:size-[305px] laptop-l:size-[380px] desktop:size-[480px] flex align-middle items-center justify-items-center`
    if (props.className) {
        classNameString = classNameString.concat(props.className)
    }
  return (
    <BentoBox className={classNameString} element={<FooterButtonElement className={props.className} icon_path={props.icon_path} center_text={props.center_text} bottom_text={props.bottom_text} link={props.link}/>} />
  )
}
