
import React, { useRef } from 'react'
import { useGLTF } from '@react-three/drei'

export function Card(props) {
  const { nodes, materials } = useGLTF('/tag.glb')
  return (
    <group {...props} dispose={null}>
      <mesh castShadow receiveShadow geometry={nodes.card.geometry} material={materials.base} />
      <mesh castShadow receiveShadow geometry={nodes.clip.geometry} material={materials.metal} />
      <mesh castShadow receiveShadow geometry={nodes.clamp.geometry} material={materials.metal} />
    </group>
  )
}

useGLTF.preload('/tag.glb')
