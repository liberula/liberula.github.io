import React from 'react'

interface BentoBoxProps{
    className? : string,
    element : React.JSX.Element
}

export default function BentoBox({className = "", element}:BentoBoxProps) {
    var classNameString = `rounded-[41px] `
    classNameString = classNameString.concat(className)
  return (
    <div className={classNameString}>
      {element}
    </div>
  )
}

