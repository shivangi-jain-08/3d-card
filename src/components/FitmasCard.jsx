import * as THREE from 'three'
import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas, extend, useThree, useFrame } from '@react-three/fiber'
import { useGLTF, useTexture, Environment, Lightformer } from '@react-three/drei'
import { BallCollider, CuboidCollider, Physics, RigidBody, useRopeJoint, useSphericalJoint } from '@react-three/rapier'
import { MeshLineGeometry, MeshLineMaterial } from 'meshline'

extend({ MeshLineGeometry, MeshLineMaterial })

// Preload assets
useGLTF.preload('/tag.glb')
useTexture.preload('/band.png')

export default function FitmasCard() {
  const [error, setError] = useState(null)

  if (error) {
    return (
      <div style={{ 
        width: '100vw', 
        height: '100vh', 
        background: 'black', 
        color: 'white', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        flexDirection: 'column',
        padding: '20px',
        textAlign: 'center'
      }}>
        <h2>Error Loading 3D Card</h2>
        <p>{error}</p>
        <p style={{ fontSize: '14px', marginTop: '20px' }}>
          Make sure /tag.glb and /band.png are in your public folder
        </p>
      </div>
    )
  }

  return (
    <div style={{ width: '100vw', height: '100vh', background: 'black' }}>
      <Suspense fallback={
        <div style={{ 
          color: 'white', 
          textAlign: 'center', 
          paddingTop: '50vh',
          fontSize: '18px'
        }}>
          Loading 3D Card...
        </div>
      }>
        <Canvas 
          camera={{ position: [0, 0, 13], fov: 25 }}
          onCreated={({ gl }) => {
            gl.setClearColor('#000000')
          }}
        >
          <ambientLight intensity={Math.PI} />
          <Physics interpolate gravity={[0, -40, 0]} timeStep={1 / 60}>
            <Band onError={setError} />
          </Physics>
          <Environment background blur={0.75}>
            <color attach="background" args={['black']} />
            <Lightformer intensity={2} color="white" position={[0, -1, 5]} rotation={[0, 0, Math.PI / 3]} scale={[100, 0.1, 1]} />
            <Lightformer intensity={3} color="white" position={[-1, -1, 1]} rotation={[0, 0, Math.PI / 3]} scale={[100, 0.1, 1]} />
            <Lightformer intensity={3} color="white" position={[1, 1, 1]} rotation={[0, 0, Math.PI / 3]} scale={[100, 0.1, 1]} />
            <Lightformer intensity={10} color="white" position={[-10, 0, 14]} rotation={[0, Math.PI / 2, Math.PI / 3]} scale={[100, 10, 1]} />
          </Environment>
        </Canvas>
      </Suspense>
    </div>
  )
}

function Band({ maxSpeed = 50, minSpeed = 10, onError }) {
  const band = useRef(), fixed = useRef(), j1 = useRef(), j2 = useRef(), j3 = useRef(), card = useRef()
  const vec = new THREE.Vector3(), ang = new THREE.Vector3(), rot = new THREE.Vector3(), dir = new THREE.Vector3()
  const segmentProps = { type: 'dynamic', canSleep: true, colliders: false, angularDamping: 2, linearDamping: 2 }
  
  const { nodes, materials } = useGLTF('/tag.glb')
  const texture = useTexture('/band.png')
  
  // Check if required nodes exist
  useEffect(() => {
    console.log('Loaded nodes:', Object.keys(nodes))
    console.log('Loaded materials:', Object.keys(materials))
    
    if (!nodes.card || !nodes.clip || !nodes.clamp) {
      console.error('Missing required nodes. Available nodes:', Object.keys(nodes))
      if (onError) {
        onError('GLB file is missing required nodes (card, clip, clamp). Available nodes: ' + Object.keys(nodes).join(', '))
      }
    }
  }, [nodes, materials, onError])
  const { width, height } = useThree((state) => state.size)
  const [curve] = useState(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(), 
    new THREE.Vector3(), 
    new THREE.Vector3(), 
    new THREE.Vector3()
  ]))
  const [dragged, drag] = useState(false)
  const [hovered, hover] = useState(false)

  useRopeJoint(fixed, j1, [[0, 0, 0], [0, 0, 0], 1])
  useRopeJoint(j1, j2, [[0, 0, 0], [0, 0, 0], 1])
  useRopeJoint(j2, j3, [[0, 0, 0], [0, 0, 0], 1])
  useSphericalJoint(j3, card, [[0, 0, 0], [0, 1.45, 0]])

  useEffect(() => {
    if (hovered) {
      document.body.style.cursor = dragged ? 'grabbing' : 'grab'
      return () => void (document.body.style.cursor = 'auto')
    }
  }, [hovered, dragged])

  useFrame((state, delta) => {
    if (dragged) {
      vec.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera)
      dir.copy(vec).sub(state.camera.position).normalize()
      vec.add(dir.multiplyScalar(state.camera.position.length()))
      ;[card, j1, j2, j3, fixed].forEach((ref) => ref.current?.wakeUp())
      card.current?.setNextKinematicTranslation({ 
        x: vec.x - dragged.x, 
        y: vec.y - dragged.y, 
        z: vec.z - dragged.z 
      })
    }
    if (fixed.current) {
      // Fix jitter when over-pulling the card
      ;[j1, j2].forEach((ref) => {
        if (!ref.current.lerped) ref.current.lerped = new THREE.Vector3().copy(ref.current.translation())
        const clampedDistance = Math.max(0.1, Math.min(1, ref.current.lerped.distanceTo(ref.current.translation())))
        ref.current.lerped.lerp(ref.current.translation(), delta * (minSpeed + clampedDistance * (maxSpeed - minSpeed)))
      })
      // Calculate catmull curve
      curve.points[0].copy(j3.current.translation())
      curve.points[1].copy(j2.current.lerped)
      curve.points[2].copy(j1.current.lerped)
      curve.points[3].copy(fixed.current.translation())
      band.current.geometry.setPoints(curve.getPoints(32))
      // Tilt it back towards the screen
      ang.copy(card.current.angvel())
      rot.copy(card.current.rotation())
      card.current.setAngvel({ x: ang.x, y: ang.y - rot.y * 0.25, z: ang.z })
    }
  })

  curve.curveType = 'chordal'
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping

  return (
    <>
      <group position={[0, 4, 0]}>
        <RigidBody ref={fixed} {...segmentProps} type="fixed" />
        <RigidBody position={[0.5, 0, 0]} ref={j1} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[1, 0, 0]} ref={j2} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[1.5, 0, 0]} ref={j3} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody 
          position={[2, 0, 0]} 
          ref={card} 
          {...segmentProps} 
          type={dragged ? 'kinematicPosition' : 'dynamic'}
        >
          <CuboidCollider args={[0.8, 1.125, 0.01]} />
          <group
            scale={2.25}
            position={[0, -1.2, -0.05]}
            onPointerOver={() => hover(true)}
            onPointerOut={() => hover(false)}
            onPointerUp={(e) => {
              e.target.releasePointerCapture(e.pointerId)
              drag(false)
            }}
            onPointerDown={(e) => {
              e.target.setPointerCapture(e.pointerId)
              drag(new THREE.Vector3().copy(e.point).sub(vec.copy(card.current.translation())))
            }}
          >
            <mesh geometry={nodes.card?.geometry}>
              <meshPhysicalMaterial 
                clearcoat={1} 
                clearcoatRoughness={0.15} 
                roughness={0.3} 
                metalness={0.5}
              >
                <FitmasCardTexture />
              </meshPhysicalMaterial>
            </mesh>
            {nodes.clip && (
              <mesh 
                geometry={nodes.clip.geometry} 
                material={materials.metal} 
                material-roughness={0.3} 
              />
            )}
            {nodes.clamp && (
              <mesh 
                geometry={nodes.clamp.geometry} 
                material={materials.metal} 
              />
            )}
          </group>
        </RigidBody>
      </group>
      <mesh ref={band}>
        <meshLineGeometry />
        <meshLineMaterial 
          color="white" 
          depthTest={false} 
          resolution={[width, height]} 
          useMap 
          map={texture} 
          repeat={[-3, 1]} 
          lineWidth={1} 
        />
      </mesh>
    </>
  )
}

function FitmasCardTexture() {
  const [texture, setTexture] = useState(null)

  useEffect(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 1024
    const ctx = canvas.getContext('2d')

    // Background - clean white/light gray
    ctx.fillStyle = '#f5f5f5'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Fitmas branding
    ctx.fillStyle = '#000000'
    ctx.font = 'bold 100px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('FITMAS', canvas.width / 2, 180)

    // Subtitle
    ctx.fillStyle = '#666666'
    ctx.font = '36px Arial'
    ctx.fillText('GYM MEMBERSHIP', canvas.width / 2, 240)

    // Member name
    ctx.fillStyle = '#000000'
    ctx.font = 'bold 60px Arial'
    ctx.fillText('JOHN DOE', canvas.width / 2, 480)

    // Member ID
    ctx.fillStyle = '#888888'
    ctx.font = '32px Arial'
    ctx.fillText('ID: FIT-2024-001', canvas.width / 2, 540)

    // Valid through
    ctx.fillStyle = '#999999'
    ctx.font = '28px Arial'
    ctx.fillText('VALID THROUGH 12/2024', canvas.width / 2, 850)

    // Decorative elements
    ctx.strokeStyle = '#e0e0e0'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(100, 300)
    ctx.lineTo(924, 300)
    ctx.stroke()

    const tex = new THREE.CanvasTexture(canvas)
    tex.needsUpdate = true
    setTexture(tex)
  }, [])

  return texture ? <primitive attach="map" object={texture} /> : null
}