import React from 'react'
import YellowTag from '../components/YellowTag'
import BentoBox from '../components/BentoBox'

interface ValueProps {
    title : string,
    description : string
}

const Value = ({title, description} : ValueProps) => {
    return(
        <div>
            <div className='absolute top-10 font-bold text-3xl text-center mx-2 italic tablet:text-left tablet:mx-4 tablet:text-3xl laptop:text-4xl laptop:mx-8 laptop-l:text-[40px] laptop-l:mx-16'>{title.toUpperCase()}</div>
            <div className='mt-[68px] font-normal text-lg mx-3 font-light text-white tablet:text-[20px] laptop:text-2xl laptop:mx-8 laptop-l:text-3xl  laptop-l:mx-12'>{description}</div>
        </div>
    )
}

export default function About() {
  return (
    <main className="flex flex-col stretch mt-10">
        <h1 className='text-black font-bold text-5xl text-center italic
        sm:text-[84px] mt-20 mb-32 tablet:mt-32
        tablet:text-[80px] 
        laptop:text-[80px] laptop:leading-[120px]
        laptop-l:text-[100px] laptop-l:leading-[120px] 
        desktop:text-[130px] desktop:leading-[180px] desktop:mt-40 desktop:mb-44
        '>ABOUT US</h1>
        <div className='flex flex-col w-full my-10 laptop-l:my-18 desktop:my-24 tablet:w-3/5'>
            <YellowTag  label={'Story'}/>
        </div>
        <div className='font-normal text-xl mx-2 tablet:mx-10 tablet:text-2xl laptop:text-3xl laptop-l:text-4xl laptop-l:mx-24 laptop-l:mb-20 desktop:text-5xl desktop:mx-40'>
        We are an independent game developer based in São Paulo, BR, with a dedication to crafting unique and memorable gaming experiences. Founded in 2023, we are still at the beginning of our journey, eager to make our mark with every new game we create.
        </div>
        <div className='flex flex-col w-full my-10 laptop-l:my-18 desktop:my-24 tablet:w-3/5 tablet:self-end'>
            <YellowTag  label={'Mission'}/>
        </div>
        <div className='font-normal text-xl mx-2 tablet:mx-10 tablet:text-2xl laptop:text-3xl laptop-l:text-4xl laptop-l:mx-24 laptop-l:mb-20 desktop:text-5xl desktop:mx-40'>
        Design games where every choice counts, creating unforgettable experiences and unique stories that inspire passion.
        </div>
        <div className='flex flex-col w-full my-10 laptop-l:my-18 desktop:my-24 tablet:w-3/5'>
            <YellowTag  label={'Vision'}/>
        </div>
        <div className='font-normal text-xl mx-2 tablet:mx-10 tablet:text-2xl laptop:text-3xl laptop-l:text-4xl laptop-l:mx-24 laptop-l:mb-20 desktop:text-5xl desktop:mx-40'>
        Become a leading game studio known for creating beloved games with impactful choices and unforgettable stories, while being a great place to work.
        </div>
        <div className='bg-black mt-14 grid grid-cols-1 tablet:grid-cols-6 gap-6 justify-items-center pb-20 laptop:gap-16'>
            <div className='flex flex-col w-full my-10 tablet:col-span-6'>
                <YellowTag  label={'Our Values'}/>
            </div>
            <BentoBox className='bg-liberula-yellow size-[300px] tablet:col-span-4 tablet:w-10/12 flex align-middle items-center justify-items-center relative' element={<Value title={'Efficacy over efficiency'} description={'We focus on achieving meaningful outcomes and solving problems effectively, even if it means taking more time or resources.'}/>}/>
            <BentoBox className='bg-liberula-yellow size-[300px] tablet:col-span-4 tablet:w-10/12 tablet:col-start-3 tablet:col-end-7 flex align-middle items-center justify-items-center relative' element={<Value title={'Done is better than perfect'} description={'We prioritize progress and delivery over perfection, embracing continuous improvement and learning.'}/>}/>
            <BentoBox className='bg-liberula-yellow size-[300px] tablet:col-span-4 tablet:w-10/12 flex align-middle items-center justify-items-center relative' element={<Value title={'Embrace the Scientific Method'} description={'We rely on systematic experimentation, data analysis, and evidence-based decision-making to guide our development process and drive innovation.'}/>}/>
            <BentoBox className='bg-liberula-yellow size-[300px] tablet:col-span-4 tablet:w-10/12 tablet:col-start-3 tablet:col-end-7 flex align-middle items-center justify-items-center relative' element={<Value title={'Extreme Ownership'} description={'We take full responsibility for our work, decisions, and results, owning both successes and failures to drive continuous improvement and accountability.'}/>}/>
        </div>
    </main>
  )
}
