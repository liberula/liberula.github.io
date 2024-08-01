'use client';
import React from "react";
import Slider, { CustomArrowProps } from "react-slick";
import Image from 'next/image'
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import Link from "next/link";
import GameCarouselItem from "./GameCarouselItem";


function SampleNextArrow(props:CustomArrowProps) {
  const { className, style, onClick } = props;
  return (
    <div
      className={className}
      style={{ ...style, display: "block", background: "black"}}
      onClick={onClick}
    />
  );
}

function SamplePrevArrow(props:CustomArrowProps) {
  const { className, style, onClick } = props;
  return (
    <div
      className={className}
      style={{ ...style, display: "block", background: "black" }}
      onClick={onClick}
    />
  );
}



export default function GamesCarrousel() {
  var settings = {
    dots: true,
    infinite: true,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
    nextArrow: <SampleNextArrow />,
    prevArrow: <SamplePrevArrow />
  };
  return (
    <div className='h-full w-10/12 block self-center'>
      <Slider {...settings}>
        <GameCarouselItem 
          image_source={"/images/recoil.png"} 
          game_title={"RECOIL"} 
          game_description={`Recoil is a minimalist 2D Platformer where you can only move by shooting. Find ways to escape the prison by solving puzzles and blasting (or sparing) enemies while collecting all the gems! But beware, The Wardens are watching...`} 
          store_sources={["/images/steam-badge.svg"]} 
          store_links={["https://store.steampowered.com/app/1949570/Recoil/"]} 
          store_alts={['Steam']}
        />
        <GameCarouselItem 
          image_source={"/images/meteoz.png"} 
          game_title={"Meteoz"} 
          game_description={`In the vast space of the Deltoria sector lies a dangerous meteor field called Meteoz. The space pilots are sent there as a rite of passage, but only few make it back. Those who choose to embark on this adventure will be rewarded with glory!... And cool space ships!
Beware though, inside this mysterious and deadly place, laws of time and physics are weirdly distorted, and only the best pilots may survive!`} 
          store_sources={["/images/google-badge.svg"]} 
          store_links={["https://play.google.com/store/apps/details?id=com.Eureka.Meteorz"]} 
          store_alts={['Google Play']}
        />
        <GameCarouselItem 
          image_source={"/images/colorpool.png"} 
          game_title={"Color Pool"} 
          game_description={"Hit the correct colors at the right time! Can you finish all levels?"} 
          store_sources={["/images/google-badge.svg"]} 
          store_links={["https://play.google.com/store/apps/details?id=com.WolfPack.ColorPool"]} 
          store_alts={['Google Play']}
        />
      </Slider>
    </div>
  );
}