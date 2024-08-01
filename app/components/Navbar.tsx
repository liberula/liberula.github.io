import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { VscTriangleDown } from "react-icons/vsc";

export default function Navbar() {
  return (
    <nav className='bg-black p-2 sticky top-0 z-10 max-w-full'>
        <div className='flex flex-row justify-between'>
            <div className='laptop:ml-8'>
                <Link href="/" className='flex justify-start items-center '>
                    <Image
                        className='mt-4 laptop:mt-4 desktop:w-[180px] desktop:h-[100px]'
                        src={"/images/logo-white.svg"}
                        width={98}
                        height={49}
                        alt='Liberula'
                        priority={true}
                    />
                    <p className='text-white no-underline font-bold object-scale-down mt-5 hidden tablet:inline tablet:text-3xl laptop:text-4xl laptop:mt-4 desktop:text-6xl'>LIBERULA</p>
                </Link>
            </div>
            
            <div className='mt-2 tablet:mr-4 laptop:mt-2 laptop-l:mr-4 laptop-l:mt-4 desktop:mt-7'>
                <ul className='flex flex-row justify-end items-center'>
                    <Link href="/games" className='ml-4 laptop-l:ml-8 hidden tablet:inline'><li className='text-white tablet:text-3xl laptop-l:text-4xl desktop:text-6xl no-underline font-bold italic hover:text-liberula-yellow inline'>GAMES</li></Link>
                    <Link href="https://subscribepage.io/liberula" className='ml-4 laptop-l:ml-8 hidden laptop-l:inline'><li className='text-white tablet:text-3xl laptop-l:text-4xl desktop:text-6xl no-underline font-bold italic hover:text-liberula-yellow inline'>NEWSLETTER</li></Link>
                    <Link href="/about" className='ml-4 laptop-l:ml-8 hidden laptop-l:inline'><li className='text-white tablet:text-3xl laptop-l:text-4xl desktop:text-6xl no-underline font-bold italic hover:text-liberula-yellow inline'>ABOUT</li></Link>
                    <Link href="mailto:gaba@liberula.com" className='ml-4 laptop-l:ml-8 hidden tablet:inline'><li className='text-white tablet:text-3xl laptop-l:text-4xl desktop:text-6xl no-underline font-bold italic hover:text-liberula-yellow inline'>CONTACT</li></Link>
                    <Link href="/#footer" className='ml-4 laptop-l:ml-8 inline laptop-l:hidden'>
                        <li>
                            <VscTriangleDown color="white" size={70} className='hover:fill-liberula-yellow'/>
                        </li>
                    </Link>
                </ul>
                
            </div>

        </div>
    </nav>
  )
}
