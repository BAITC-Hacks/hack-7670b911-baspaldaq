import { Component, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, Html, Stars } from "@react-three/drei";
import * as THREE from "three";

const START_POINT = new THREE.Vector3(3.2, -1.15, 0);
const SYSTEM_CENTER = new THREE.Vector3(23, -10, 0);
const ROCKET_PROFILE = [
  [0, 2.28],
  [0.12, 2.12],
  [0.34, 1.7],
  [0.5, 1.18],
  [0.56, 0.7],
  [0.58, -0.88],
  [0.5, -1.18],
  [0.39, -1.34],
].map(([radius, height]) => new THREE.Vector2(radius, height));

const FLIGHT_PATH = new THREE.CatmullRomCurve3(
  [
    START_POINT,
    new THREE.Vector3(3.15, -3.4, 0.1),
    new THREE.Vector3(3.1, -7.2, -0.2),
    new THREE.Vector3(4.2, -10.4, 0),
    new THREE.Vector3(7.8, -12.2, 0.2),
    new THREE.Vector3(12.8, -12, -0.1),
    new THREE.Vector3(17.1, -10.7, 0),
    new THREE.Vector3(19.4, -10, 0),
  ],
  false,
  "catmullrom",
  0.62,
);

const PLANETS = [
  {
    id: "task",
    label: "Задача",
    position: [23, -10, 0],
    size: 2.55,
    color: "#b9b7ff",
    emissive: "#4b4a9d",
    detail: "центр системы",
    rings: true,
  },
  {
    id: "context",
    label: "Контекст",
    position: [20.2, -6.4, -0.8],
    size: 1.35,
    color: "#7cd9e8",
    emissive: "#1b6470",
    detail: "неизвестно",
  },
  {
    id: "users",
    label: "Пользователи",
    position: [26.6, -6.8, -1.3],
    size: 1.62,
    color: "#7f9fe5",
    emissive: "#304a85",
    detail: "неизвестно",
    rings: true,
  },
  {
    id: "data",
    label: "Данные",
    position: [28.3, -10.4, -1.8],
    size: 1.18,
    color: "#7fc8aa",
    emissive: "#285b48",
    detail: "неизвестно",
  },
  {
    id: "result",
    label: "Результат",
    position: [26.1, -14.1, -1],
    size: 1.48,
    color: "#d9ff42",
    emissive: "#71851e",
    detail: "неизвестно",
  },
  {
    id: "success",
    label: "Критерии успеха",
    position: [21.5, -14.7, -1.6],
    size: 1.08,
    color: "#efb36f",
    emissive: "#784b25",
    detail: "неизвестно",
  },
  {
    id: "constraints",
    label: "Ограничения",
    position: [17.9, -11.8, -1.4],
    size: 1.3,
    color: "#d98492",
    emissive: "#6d2f3c",
    detail: "неизвестно",
  },
  {
    id: "communication",
    label: "Коммуникация",
    position: [17.5, -7.9, -2],
    size: 0.92,
    color: "#86bcb4",
    emissive: "#315a54",
    detail: "неизвестно",
  },
];

class SceneBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return <div className="webgl-message">3D-сцена недоступна</div>;
    }

    return this.props.children;
  }
}

function RocketModel({ rocketRef, reducedMotion, visible, ignited }) {
  const flameRef = useRef(null);
  const innerFlameRef = useRef(null);
  const visualRef = useRef(null);
  const { size } = useThree();
  const finShape = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0.34, -0.52);
    shape.bezierCurveTo(0.72, -0.82, 0.94, -1.28, 1.02, -1.76);
    shape.lineTo(0.48, -1.52);
    shape.lineTo(0.18, -0.82);
    shape.closePath();
    return shape;
  }, []);

  useFrame(({ clock }, delta) => {
    if (visualRef.current) {
      visualRef.current.visible = visible;
      const targetScale = visible ? (size.width < 700 ? 0.38 : 0.48) : 0.001;
      const nextScale = THREE.MathUtils.damp(
        visualRef.current.scale.x,
        targetScale,
        10,
        delta,
      );
      visualRef.current.scale.setScalar(nextScale);
    }

    if (!flameRef.current || !innerFlameRef.current || reducedMotion || !ignited) {
      return;
    }

    const pulse = 1 + Math.sin(clock.elapsedTime * 18) * 0.16;
    flameRef.current.scale.y = pulse;
    innerFlameRef.current.scale.y = 1 + Math.cos(clock.elapsedTime * 23) * 0.12;
  });

  return (
    <group ref={rocketRef}>
      <group ref={visualRef} visible={visible} scale={0.001}>
      <mesh castShadow receiveShadow>
        <latheGeometry args={[ROCKET_PROFILE, 64]} />
        <meshStandardMaterial
          color="#e9edf2"
          metalness={0.64}
          roughness={0.2}
        />
      </mesh>
      <mesh position={[0, 0.16, 0]}>
        <cylinderGeometry args={[0.585, 0.585, 0.18, 48]} />
        <meshStandardMaterial color="#246bfd" metalness={0.42} roughness={0.24} />
      </mesh>
      <mesh position={[0, 0.92, 0.49]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.28, 0.28, 0.1, 32]} />
        <meshStandardMaterial
          color="#07131f"
          emissive="#3a91ff"
          emissiveIntensity={0.38}
          metalness={0.6}
          roughness={0.16}
        />
      </mesh>
      {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((rotation) => (
        <group key={rotation} rotation={[0, rotation, 0]}>
          <mesh position={[0, 0, 0.43]}>
            <extrudeGeometry
              args={[finShape, { depth: 0.12, bevelEnabled: true, bevelSize: 0.035, bevelThickness: 0.035 }]}
            />
            <meshStandardMaterial color="#246bfd" metalness={0.48} roughness={0.22} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, -1.42, 0]}>
        <cylinderGeometry args={[0.34, 0.43, 0.26, 32]} />
        <meshStandardMaterial color="#252d39" metalness={0.84} roughness={0.18} />
      </mesh>
      <group visible={ignited}>
        <mesh ref={flameRef} position={[0, -2.18, 0]} rotation={[0, 0, Math.PI]}>
          <coneGeometry args={[0.32, 1.55, 24]} />
          <meshBasicMaterial color="#369cff" transparent opacity={0.72} />
        </mesh>
        <mesh ref={innerFlameRef} position={[0, -1.98, 0]} rotation={[0, 0, Math.PI]}>
          <coneGeometry args={[0.17, 1.06, 20]} />
          <meshBasicMaterial color="#f3fbff" transparent opacity={0.94} />
        </mesh>
        <pointLight position={[0, -2.25, 0]} color="#369cff" intensity={4.2} distance={8} />
      </group>
      </group>
    </group>
  );
}

function OrbitLine({ radiusX, radiusY, rotation = 0 }) {
  const geometry = useMemo(() => {
    const curve = new THREE.EllipseCurve(0, 0, radiusX, radiusY, 0, Math.PI * 2);
    const points = curve.getPoints(128).map((point) => new THREE.Vector3(point.x, point.y, 0));
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [radiusX, radiusY]);

  return (
    <line geometry={geometry} rotation={[0, 0, rotation]}>
      <lineBasicMaterial color="#9eb2b7" transparent opacity={0.12} />
    </line>
  );
}

function Planet({ planet, labelVisible, reducedMotion }) {
  const meshRef = useRef(null);

  useFrame((_, delta) => {
    if (meshRef.current && !reducedMotion) {
      meshRef.current.rotation.y += delta * (planet.id === "task" ? 0.07 : 0.12);
    }
  });

  const content = (
    <group position={planet.position}>
      <mesh ref={meshRef} castShadow receiveShadow>
        <sphereGeometry args={[planet.size, 48, 48]} />
        <meshStandardMaterial
          color={planet.color}
          emissive={planet.emissive}
          emissiveIntensity={planet.id === "task" ? 0.34 : 0.2}
          metalness={0.08}
          roughness={0.58}
        />
      </mesh>
      <mesh scale={1.025}>
        <sphereGeometry args={[planet.size, 28, 28]} />
        <meshBasicMaterial color={planet.color} wireframe transparent opacity={0.08} />
      </mesh>
      {planet.rings && (
        <mesh rotation={[Math.PI / 2.45, 0.1, 0.22]}>
          <ringGeometry args={[planet.size * 1.34, planet.size * 1.48, 64]} />
          <meshBasicMaterial
            color={planet.color}
            transparent
            opacity={0.34}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
      {labelVisible && (
        <Html center distanceFactor={12} position={[0, -planet.size - 0.58, 0]}>
          <div className={`planet-label ${planet.id === "task" ? "is-task" : ""}`}>
            <strong>{planet.label}</strong>
            <span>{planet.detail}</span>
          </div>
        </Html>
      )}
    </group>
  );

  if (reducedMotion || planet.id === "task") {
    return content;
  }

  return (
    <Float speed={0.65} rotationIntensity={0.06} floatIntensity={0.22}>
      {content}
    </Float>
  );
}

function PlanetSystem({ visible, reducedMotion }) {
  const { size } = useThree();
  const compact = size.width < 700;

  return (
    <group>
      <group position={SYSTEM_CENTER}>
        <OrbitLine radiusX={5.7} radiusY={4.8} rotation={-0.08} />
        <OrbitLine radiusX={8.2} radiusY={6.2} rotation={0.12} />
      </group>
      {PLANETS.map((planet) => (
        <Planet
          key={planet.id}
          planet={planet}
          labelVisible={visible && (!compact || planet.id === "task")}
          reducedMotion={reducedMotion}
        />
      ))}
    </group>
  );
}

function FlightDirector({ phase, reducedMotion, rocketVisible, onArrive, onMilestone }) {
  const rocketRef = useRef(null);
  const progressRef = useRef(0);
  const lookAtRef = useRef(new THREE.Vector3(0, 0, 0));
  const milestoneRef = useRef("ready");
  const arrivedRef = useRef(false);
  const { camera, size } = useThree();

  useFrame(({ clock }, delta) => {
    if (!rocketRef.current) {
      return;
    }

    if (phase === "entry") {
      const floatOffset = reducedMotion ? 0 : Math.sin(clock.elapsedTime * 1.4) * 0.08;
      rocketRef.current.position.copy(START_POINT);
      rocketRef.current.position.y += floatOffset;
      rocketRef.current.rotation.set(0, 0, 0.08);
      const compact = size.width < 700;
      const entryCamera = compact
        ? new THREE.Vector3(1.4, 0.7, 15)
        : new THREE.Vector3(0, 0, 10);
      const entryLookAt = compact
        ? new THREE.Vector3(1.4, 0.7, 0)
        : new THREE.Vector3(0, 0, 0);
      camera.position.lerp(
        entryCamera,
        1 - Math.exp(-delta * 3),
      );
      lookAtRef.current.lerp(entryLookAt, 1 - Math.exp(-delta * 3));
      camera.lookAt(lookAtRef.current);
      return;
    }

    if (phase === "flight") {
      const duration = reducedMotion ? 0.55 : 7.2;
      progressRef.current = Math.min(1, progressRef.current + delta / duration);
      const progress = progressRef.current;
      const eased = THREE.MathUtils.smoothstep(progress, 0, 1);
      const point = FLIGHT_PATH.getPointAt(eased);
      const tangent = FLIGHT_PATH.getTangentAt(Math.min(0.999, eased + 0.002)).normalize();
      const orientation = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        tangent,
      );

      rocketRef.current.position.copy(point);
      rocketRef.current.quaternion.slerp(orientation, 1 - Math.exp(-delta * 9));

      const cameraOffset = size.width < 700
        ? new THREE.Vector3(0, 1.2, 12.8)
        : new THREE.Vector3(-0.8, 1.35, 9.4);
      const cameraTarget = point.clone().add(cameraOffset);
      camera.position.lerp(cameraTarget, 1 - Math.exp(-delta * 2.7));
      lookAtRef.current.lerp(point, 1 - Math.exp(-delta * 4.2));
      camera.lookAt(lookAtRef.current);

      if (progress > 0.43 && milestoneRef.current !== "turn") {
        milestoneRef.current = "turn";
        onMilestone("turn");
      }

      if (progress >= 1 && !arrivedRef.current) {
        arrivedRef.current = true;
        onArrive();
      }
      return;
    }

    const isCompact = size.width < 700;
    const finalPosition = isCompact
      ? new THREE.Vector3(21.5, -6.4, 18)
      : new THREE.Vector3(20.2, -9.2, 13.5);
    const finalLookAt = isCompact
      ? new THREE.Vector3(22.2, -9.3, 0)
      : new THREE.Vector3(22.1, -10, 0);

    camera.position.lerp(finalPosition, 1 - Math.exp(-delta * 1.8));
    lookAtRef.current.lerp(finalLookAt, 1 - Math.exp(-delta * 2));
    camera.lookAt(lookAtRef.current);
  });

  return (
    <RocketModel
      rocketRef={rocketRef}
      reducedMotion={reducedMotion}
      visible={rocketVisible}
      ignited={phase === "flight"}
    />
  );
}

function Scene({ phase, reducedMotion, rocketVisible, onArrive, onMilestone }) {
  return (
    <>
      <color attach="background" args={["#07090d"]} />
      <fog attach="fog" args={["#07090d", 18, 58]} />
      <ambientLight intensity={0.34} />
      <directionalLight position={[4, 8, 9]} intensity={1.35} color="#eaf8fa" />
      <pointLight position={[23, -8, 8]} intensity={2.8} color="#b9b7ff" distance={30} />
      <Stars
        radius={52}
        depth={36}
        count={reducedMotion ? 420 : 1100}
        factor={2.2}
        saturation={0.18}
        fade
        speed={reducedMotion ? 0 : 0.22}
      />
      <PlanetSystem visible={phase === "arrived"} reducedMotion={reducedMotion} />
      <FlightDirector
        phase={phase}
        reducedMotion={reducedMotion}
        rocketVisible={rocketVisible}
        onArrive={onArrive}
        onMilestone={onMilestone}
      />
    </>
  );
}

export default function SpaceScene({
  phase,
  reducedMotion,
  rocketVisible,
  onArrive,
  onMilestone,
}) {
  return (
    <SceneBoundary>
      <div className="space-canvas" aria-hidden="true">
        <Canvas
          camera={{ position: [0, 0, 10], fov: 43, near: 0.1, far: 100 }}
          dpr={[1, 1.6]}
          gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        >
          <Scene
            phase={phase}
            reducedMotion={reducedMotion}
            rocketVisible={rocketVisible}
            onArrive={onArrive}
            onMilestone={onMilestone}
          />
        </Canvas>
      </div>
    </SceneBoundary>
  );
}
