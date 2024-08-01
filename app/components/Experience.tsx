import React from 'react'
import BentoBox from './BentoBox'
import Image from 'next/image'


const CompletedProjects = () => {
    return(
        <div className='flex flex-col items-center justify-center gap-3 h-full flex-1 py-9 px-10'>
            <div className='flex flex-row items-center mt-5'>
                <span className='text-black font-bold text-8xl desktop:text-[200px]'>20</span><span className='text-black font-bold text-5xl desktop:text-[150px]'>+</span>
            </div>
            <p className='text-white text-2xl desktop:text-[40px] font-normal text-center w-full'>Completed projects</p>
        </div>
    )
}

const YearOfExperience = () => {
    return(
        <div className='flex flex-col items-center justify-center h-full gap-1 py-14 px-10'>
            <div className='flex flex-row items-center mt-5'>
                <span className='text-black font-bold text-8xl desktop:text-[200px]'>7</span><span className='text-black font-bold text-3xl desktop:text-[60px]'>years</span>
            </div>
            <p className='text-white text-3xl desktop:text-[40px] font-normal text-center'>Experience</p>
        </div>
    )
}

const TruestedBy = () => {
    return(
        <div className='flex flex-col items-center justify-center h-full '>
            <span className='text-black text-2xl tablet:text-4xl font-bold text-center absolute top-4 tablet:top-16 desktop:top-8'>Trusted by</span>
            <div>
                <Image
                    className='mt-20 tablet:hidden'
                    src={"/images/companies.svg"}
                    width={160}
                    height={600}
                    alt='Amazon AWS, Afterverse, Space Sheep Games, Tapps'
                />
                <Image
                    className='mt-4 laptop:mt-4 hidden tablet:block desktop:w-[750px]'
                    src={"/images/companies-side.svg"}
                    width={600}
                    height={180}
                    alt='Amazon AWS, Afterverse, Space Sheep Games, Tapps'
                />
            </div>
        </div>
    )
}

const ProficientWith = () => {
    return(
        <div className='flex flex-col items-center justify-center h-full gap-1'>
            <span className='text-black text-2xl tablet:text-4xl  font-bold text-center absolute top-4 tablet:top-16 desktop:top-8'>Proficient with</span>
            <div>
                <Image
                    className='mt-16 my-10 laptop:mt-4 tablet:hidden'
                    src={"/images/engines.svg"}
                    width={175}
                    height={150}
                    alt='Godot, Unity'
                />
                <Image
                    className='mt-16 my-10 desktop:mt-14 hidden tablet:block desktop:w-[750px]'
                    src={"/images/engines-side.svg"}
                    width={500}
                    height={180}
                    alt='Godot, Unity'
                />
            </div>
        </div>
    )
}

export default function Experience() {
  return (
    <div className=' bg-black flex flex-col  justify-center  justify-items-center items-center'>
        <div className='flex flex-col items-center mt-40 flex-wrap bg-black justify-items-center py-16 gap-6 tablet:flex-row justify-center w-5/6 desktop:w-4/6 desktop:mt-20'>
            <BentoBox className='bg-liberula-yellow justify-center size-[280px] laptop:size-[305px] laptop-l:size-[305px] desktop:size-[480px] ' element={<CompletedProjects/>} />
            <BentoBox className='bg-liberula-yellow justify-center size-[280px] laptop:size-[305px] laptop-l:size-[305px] desktop:size-[480px] ' element={<YearOfExperience/>} />
            <BentoBox className='bg-liberula-yellow justify-center size-[280px] min-h-[450px] tablet:w-[584px] laptop:w-[634px] laptop-l:w-[634px]  desktop:w-[984px]  relative' element={<TruestedBy/>} />
            <BentoBox className='bg-liberula-yellow justify-center size-[280px] min-h-[300px] tablet:w-[584px] laptop:w-[634px] laptop-l:w-[634px]  desktop:w-[984px]  desktop:h-[360px]   relative' element={<ProficientWith/>} />
        </div>
    </div>
  )
}
