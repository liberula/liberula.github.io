import React from 'react'
import Image from 'next/image'
import Link from 'next/link'

interface CarouselItemProps {
    image_source : string,
    game_title : string,
    game_description : string,
    store_sources : string[],
    store_links : string[],
    store_alts : string[]
  }
  
  
  
export default function GameCarouselItem({image_source,game_title, game_description, store_sources, store_links, store_alts} : CarouselItemProps){
    return (
      <div className="flex flex-col content-center items-center">
            <Image
              className="h-fit w-fit max-h-[700px]"
              src={image_source}
              width={1920}
              height={1080}
              alt={game_title} 
            />
            <h1 className="text-3xl font-bold italic text-black self-start ml-2 mt-4 mb-3 desktop:text-5xl desktop:mt-10">{game_title.toUpperCase()}</h1>
            <p className="text-lg font-normal text-black self-start ml-2 desktop:text-3xl">
              {game_description}
            </p>
            <div className='flex flex-row self-end gap-1 tablet:gap-6 '>
            {
              store_sources.map((store_source, i) => 
                <Link className="self-end h-fit w-fit max-w-32 mt-6 mr-1 tablet:w-32 desktop:w-60 desktop:max-w-60 desktop:h-60" key={i} href={store_links[i]}>
                  <Image
                    src={store_source}
                    width={300}
                    height={300}
                    alt={store_alts[i]}
                  />
                </Link>
              )
            }
            </div>
          </div>
    );
  }
