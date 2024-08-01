import React from 'react'
import FooterButton from './FooterButton'
import Link from 'next/link'
import Image from 'next/image'


export default function Footer() {
  return (
    <div className='flex flex-col bg-liberula-yellow' >
      <div className=' grid grid-cols-1 tablet:grid-cols-2 laptop:grid-cols-3 items-center justify-items-center align-middle gap-10 pt-10 '>
        <FooterButton icon_path={'/images/news.svg'} center_text={'Keep up with what we\'re doing'} bottom_text={'JOIN OUR NEWSLETTER'} link={'https://subscribepage.io/liberula'}  />
        <FooterButton icon_path={'/images/games.svg'} center_text={'Want something to play'} bottom_text={'CHECK OUR GAMES'}  link={'/games'} />
        <FooterButton icon_path={'/images/contact.svg'} center_text={'Have a project in mind?'} bottom_text={'CONTACT US'}  link={"mailto:gaba@liberula.com"} />
        <FooterButton icon_path={'/images/mission.svg'} center_text={'Our mission and values'} bottom_text={'READ MORE'} link={'/about'}  />
        <FooterButton icon_path={'/images/community.svg'} center_text={'Let\'s have a chat!'} bottom_text={'JOIN OUR COMMUNITY'} link={'https://linktr.ee/liberulagames'}  />
        <Link href={'/'}>
          <Image  
            src={'images/logo.svg'}
            width={300}
            height={300}
            alt={'logo'}/>
        </Link>
        
      </div>
      <div className='grid grid-cols-2 justify-center align-center items-center pt-10' id='footer'>
          <span className='align-center text-center'>© LIBERULA 2024</span>
          <Link className='align-center text-center' href={'/tos'}>TERMS OF SERVICE</Link>
          <Link className='align-center text-center' href={'/'}>BACK TO TOP</Link>
          <Link className='align-center text-center' href={'/privacy-policy'}>PRIVACY POLICY</Link>
      </div>
    </div>
    
 
    
  )
}
