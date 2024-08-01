
'use client';
import React from 'react'
import { FC } from 'react';
import { useForm } from 'react-hook-form';
import { sendEmail } from '../../utils/send-email';
export type FormData = {
    name: string;
    email: string;
    message: string;
  };


const FormElement : FC = () => {
    const { register, handleSubmit } = useForm<FormData>();

    function onSubmit(data: FormData) {
      sendEmail(data);
    }
    return(
        <form className='w-5/6 tablet:w-4/6 desktop:w-4/12' onSubmit={handleSubmit(onSubmit)}>
        <div className='mb-5'>
        <label
            htmlFor='name'
            className='mb-3 block font-normal text-2xl text-black'
        >
            Name
        </label>
        <input
            type='text'
            placeholder='Name'
            className='w-full rounded-md border border-gray-300 bg-white py-3 px-6 text-base font-medium text-gray-700 outline-none focus:border-purple-500 focus:shadow-md'
            {...register('name', { required: true })}
        />
        </div>
        <div className='mb-5'>
        <label
            htmlFor='email'
            className='mb-3 block font-normal text-2xl text-black'
        >
            Email
        </label>
        <input
            type='email'
            placeholder='example@domain.com'
            className='w-full rounded-md border border-gray-300 bg-white py-3 px-6 text-base font-medium text-gray-700 outline-none focus:border-purple-500 focus:shadow-md'
            {...register('email', { required: true })}
        />
        </div>
        <div className='mb-5'>
        <label
            htmlFor='message'
            className='mb-3 block font-normal text-2xl text-black'
        >
            Message
        </label>
        <textarea
            rows={4}
            placeholder='Type your message'
            className='w-full resize-none rounded-md border border-gray-300 bg-white py-3 px-6 text-base font-medium text-gray-700 outline-none focus:border-purple-500 focus:shadow-md'
            {...register('message', { required: true })}
        ></textarea>
        </div>
        <div>
        <button className='hover:shadow-form w-full bg-black py-3 px-8 text-base font-semibold text-white rounded-none desktop:py-6'>
            <span className='font-title italic font-bold text-3xl desktop:text-5xl'>SEND</span>
        </button>
        </div>
    </form>
    );
};


export default function Contact() {
  return (
    <div className='flex flex-col items-center gap-10 
    sm:gap-20
    tablet:gap-20
    laptop-l:mx-20 
    '>
        <h1 className='text-black font-bold text-5xl text-center italic
        sm:text-[84px] mt-20
        tablet:text-[80px] tablet:mt-5 
        laptop:text-[80px] laptop:leading-[120px] laptop:mt-0
        laptop-l:text-[100px] laptop-l:leading-[120px] laptop-l:mt-0
        desktop:text-[130px] desktop:leading-[180px] desktop:mx-80
        '>CONTACT US</h1>
        <FormElement/>
    </div>
  )
}
