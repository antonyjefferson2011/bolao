// ============================================================
// GeoVision 3D — Laboratório de Geometria Espacial
// Three.js + MediaPipe (via globais window.Hands / window.Camera)
// ============================================================

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';

// ============================================================
// 1. DADOS GEOMÉTRICOS E MATEMÁTICOS
// ============================================================

const FIGURES = {
  cube: {
    name: 'Cubo',
    type: 'polyhedron',
    params: { a: 2 },
    paramDefs: [{ key: 'a', label: 'Aresta', min: 0.5, max: 5, step: 0.1 }],
    properties: (p) => {
      const a = p.a;
      return {
        'Aresta (a)': a.toFixed(2),
        'Faces': 6,
        'Arestas': 12,
        'Vértices': 8,
        'Área da base': (a * a).toFixed(2),
        'Área lateral': (4 * a * a).toFixed(2),
        'Área total': (6 * a * a).toFixed(2),
        'Volume': (a * a * a).toFixed(2),
      };
    },
    formulas: (p) => [
      { label: 'Área da base', formula: 'a²', calc: `${p.a.toFixed(2)}² = ${(p.a*p.a).toFixed(2)}` },
      { label: 'Área lateral', formula: '4a²', calc: `4·${p.a.toFixed(2)}² = ${(4*p.a*p.a).toFixed(2)}` },
      { label: 'Área total', formula: '6a²', calc: `6·${p.a.toFixed(2)}² = ${(6*p.a*p.a).toFixed(2)}` },
      { label: 'Volume', formula: 'a³', calc: `${p.a.toFixed(2)}³ = ${(p.a*p.a*p.a).toFixed(2)}` },
    ],
    createGeometry: (p) => new THREE.BoxGeometry(p.a, p.a, p.a),
    createPlanification: (p) => createCubePlanification(p.a),
  },
  paralelepipedo: {
    name: 'Paralelepípedo',
    type: 'polyhedron',
    params: { a: 2, b: 1.5, c: 1 },
    paramDefs: [
      { key: 'a', label: 'Comprimento', min: 0.5, max: 5, step: 0.1 },
      { key: 'b', label: 'Largura', min: 0.5, max: 5, step: 0.1 },
      { key: 'c', label: 'Altura', min: 0.5, max: 5, step: 0.1 },
    ],
    properties: (p) => {
      const { a, b, c } = p;
      const base = a * b;
      const lateral = 2 * (a * c + b * c);
      return {
        'Comprimento (a)': a.toFixed(2),
        'Largura (b)': b.toFixed(2),
        'Altura (c)': c.toFixed(2),
        'Faces': 6,
        'Arestas': 12,
        'Vértices': 8,
        'Área da base': base.toFixed(2),
        'Área lateral': lateral.toFixed(2),
        'Área total': (2 * base + lateral).toFixed(2),
        'Volume': (a * b * c).toFixed(2),
      };
    },
    formulas: (p) => [
      { label: 'Área da base', formula: 'a·b', calc: `${p.a.toFixed(2)}·${p.b.toFixed(2)} = ${(p.a*p.b).toFixed(2)}` },
      { label: 'Área lateral', formula: '2(a·c + b·c)', calc: `2(${p.a.toFixed(2)}·${p.c.toFixed(2)} + ${p.b.toFixed(2)}·${p.c.toFixed(2)}) = ${(2*(p.a*p.c+p.b*p.c)).toFixed(2)}` },
      { label: 'Área total', formula: '2(ab + ac + bc)', calc: `2(${p.a.toFixed(2)}·${p.b.toFixed(2)} + ${p.a.toFixed(2)}·${p.c.toFixed(2)} + ${p.b.toFixed(2)}·${p.c.toFixed(2)}) = ${(2*(p.a*p.b+p.a*p.c+p.b*p.c)).toFixed(2)}` },
      { label: 'Volume', formula: 'a·b·c', calc: `${p.a.toFixed(2)}·${p.b.toFixed(2)}·${p.c.toFixed(2)} = ${(p.a*p.b*p.c).toFixed(2)}` },
    ],
    createGeometry: (p) => new THREE.BoxGeometry(p.a, p.c, p.b),
    createPlanification: (p) => createParalelepipedoPlanification(p.a, p.c, p.b),
  },
  prisma_triangular: {
    name: 'Prisma Triangular',
    type: 'polyhedron',
    params: { a: 2, h: 2 },
    paramDefs: [
      { key: 'a', label: 'Lado da base', min: 0.5, max: 5, step: 0.1 },
      { key: 'h', label: 'Altura', min: 0.5, max: 5, step: 0.1 },
    ],
    properties: (p) => {
      const { a, h } = p;
      const baseArea = (Math.sqrt(3) / 4) * a * a;
      const lateralArea = 3 * a * h;
      return {
        'Lado da base (a)': a.toFixed(2),
        'Altura (h)': h.toFixed(2),
        'Faces': 5,
        'Arestas': 9,
        'Vértices': 6,
        'Área da base': baseArea.toFixed(2),
        'Área lateral': lateralArea.toFixed(2),
        'Área total': (2 * baseArea + lateralArea).toFixed(2),
        'Volume': (baseArea * h).toFixed(2),
      };
    },
    formulas: (p) => {
      const baseArea = (Math.sqrt(3) / 4) * p.a * p.a;
      const lateralArea = 3 * p.a * p.h;
      return [
        { label: 'Área da base', formula: '(√3/4)·a²', calc: `(√3/4)·${p.a.toFixed(2)}² = ${baseArea.toFixed(2)}` },
        { label: 'Área lateral', formula: '3·a·h', calc: `3·${p.a.toFixed(2)}·${p.h.toFixed(2)} = ${lateralArea.toFixed(2)}` },
        { label: 'Área total', formula: '2·Ab + Al', calc: `2·${baseArea.toFixed(2)} + ${lateralArea.toFixed(2)} = ${(2*baseArea+lateralArea).toFixed(2)}` },
        { label: 'Volume', formula: 'Ab·h', calc: `${baseArea.toFixed(2)}·${p.h.toFixed(2)} = ${(baseArea*p.h).toFixed(2)}` },
      ];
    },
    createGeometry: (p) => {
      const shape = new THREE.Shape();
      const a = p.a;
      const h = Math.sqrt(3) / 2 * a;
      shape.moveTo(0, h * 2/3);
      shape.lineTo(-a/2, -h/3);
      shape.lineTo(a/2, -h/3);
      shape.closePath();
      const extrude = new THREE.ExtrudeGeometry(shape, { depth: p.h, bevelEnabled: false });
      extrude.center();
      return extrude;
    },
    createPlanification: (p) => createPrismaTriangularPlanification(p.a, p.h),
  },
  prisma_hexagonal: {
    name: 'Prisma Hexagonal',
    type: 'polyhedron',
    params: { a: 1.5, h: 2 },
    paramDefs: [
      { key: 'a', label: 'Lado da base', min: 0.5, max: 4, step: 0.1 },
      { key: 'h', label: 'Altura', min: 0.5, max: 5, step: 0.1 },
    ],
    properties: (p) => {
      const { a, h } = p;
      const baseArea = (3 * Math.sqrt(3) / 2) * a * a;
      const lateralArea = 6 * a * h;
      return {
        'Lado da base (a)': a.toFixed(2),
        'Altura (h)': h.toFixed(2),
        'Faces': 8,
        'Arestas': 18,
        'Vértices': 12,
        'Área da base': baseArea.toFixed(2),
        'Área lateral': lateralArea.toFixed(2),
        'Área total': (2 * baseArea + lateralArea).toFixed(2),
        'Volume': (baseArea * h).toFixed(2),
      };
    },
    formulas: (p) => {
      const baseArea = (3 * Math.sqrt(3) / 2) * p.a * p.a;
      const lateralArea = 6 * p.a * p.h;
      return [
        { label: 'Área da base', formula: '(3√3/2)·a²', calc: `(3√3/2)·${p.a.toFixed(2)}² = ${baseArea.toFixed(2)}` },
        { label: 'Área lateral', formula: '6·a·h', calc: `6·${p.a.toFixed(2)}·${p.h.toFixed(2)} = ${lateralArea.toFixed(2)}` },
        { label: 'Área total', formula: '2·Ab + Al', calc: `2·${baseArea.toFixed(2)} + ${lateralArea.toFixed(2)} = ${(2*baseArea+lateralArea).toFixed(2)}` },
        { label: 'Volume', formula: 'Ab·h', calc: `${baseArea.toFixed(2)}·${p.h.toFixed(2)} = ${(baseArea*p.h).toFixed(2)}` },
      ];
    },
    createGeometry: (p) => new THREE.CylinderGeometry(p.a, p.a, p.h, 6),
    createPlanification: (p) => createPrismaHexagonalPlanification(p.a, p.h),
  },
  piramide_triangular: {
    name: 'Pirâmide Triangular',
    type: 'polyhedron',
    params: { a: 2, h: 2.5 },
    paramDefs: [
      { key: 'a', label: 'Lado da base', min: 0.5, max: 5, step: 0.1 },
      { key: 'h', label: 'Altura', min: 0.5, max: 5, step: 0.1 },
    ],
    properties: (p) => {
      const { a, h } = p;
      const baseArea = (Math.sqrt(3) / 4) * a * a;
      const apothem = a / (2 * Math.sqrt(3));
      const slantHeight = Math.sqrt(h * h + apothem * apothem);
      const lateralArea = 3 * (a * slantHeight / 2);
      return {
        'Lado da base (a)': a.toFixed(2),
        'Altura (h)': h.toFixed(2),
        'Faces': 4,
        'Arestas': 6,
        'Vértices': 4,
        'Área da base': baseArea.toFixed(2),
        'Área lateral': lateralArea.toFixed(2),
        'Área total': (baseArea + lateralArea).toFixed(2),
        'Volume': (baseArea * h / 3).toFixed(2),
      };
    },
    formulas: (p) => {
      const baseArea = (Math.sqrt(3) / 4) * p.a * p.a;
      const apothem = p.a / (2 * Math.sqrt(3));
      const slantHeight = Math.sqrt(p.h * p.h + apothem * apothem);
      const lateralArea = 3 * (p.a * slantHeight / 2);
      return [
        { label: 'Área da base', formula: '(√3/4)·a²', calc: `(√3/4)·${p.a.toFixed(2)}² = ${baseArea.toFixed(2)}` },
        { label: 'Altura da face', formula: '√(h² + m²)', calc: `√(${p.h.toFixed(2)}² + ${apothem.toFixed(2)}²) = ${slantHeight.toFixed(2)}` },
        { label: 'Área lateral', formula: '3·(a·g/2)', calc: `3·(${p.a.toFixed(2)}·${slantHeight.toFixed(2)}/2) = ${lateralArea.toFixed(2)}` },
        { label: 'Volume', formula: 'Ab·h/3', calc: `${baseArea.toFixed(2)}·${p.h.toFixed(2)}/3 = ${(baseArea*p.h/3).toFixed(2)}` },
      ];
    },
    createGeometry: (p) => new THREE.ConeGeometry(p.a / Math.sqrt(3), p.h, 3),
    createPlanification: (p) => createPiramideTriangularPlanification(p.a, p.h),
  },
  piramide_quadrangular: {
    name: 'Pirâmide Quadrangular',
    type: 'polyhedron',
    params: { a: 2, h: 2.5 },
    paramDefs: [
      { key: 'a', label: 'Lado da base', min: 0.5, max: 5, step: 0.1 },
      { key: 'h', label: 'Altura', min: 0.5, max: 5, step: 0.1 },
    ],
    properties: (p) => {
      const { a, h } = p;
      const baseArea = a * a;
      const apothem = a / 2;
      const slantHeight = Math.sqrt(h * h + apothem * apothem);
      const lateralArea = 4 * (a * slantHeight / 2);
      return {
        'Lado da base (a)': a.toFixed(2),
        'Altura (h)': h.toFixed(2),
        'Faces': 5,
        'Arestas': 8,
        'Vértices': 5,
        'Área da base': baseArea.toFixed(2),
        'Área lateral': lateralArea.toFixed(2),
        'Área total': (baseArea + lateralArea).toFixed(2),
        'Volume': (baseArea * h / 3).toFixed(2),
      };
    },
    formulas: (p) => {
      const baseArea = p.a * p.a;
      const apothem = p.a / 2;
      const slantHeight = Math.sqrt(p.h * p.h + apothem * apothem);
      const lateralArea = 4 * (p.a * slantHeight / 2);
      return [
        { label: 'Área da base', formula: 'a²', calc: `${p.a.toFixed(2)}² = ${baseArea.toFixed(2)}` },
        { label: 'Altura da face', formula: '√(h² + m²)', calc: `√(${p.h.toFixed(2)}² + ${apothem.toFixed(2)}²) = ${slantHeight.toFixed(2)}` },
        { label: 'Área lateral', formula: '4·(a·g/2)', calc: `4·(${p.a.toFixed(2)}·${slantHeight.toFixed(2)}/2) = ${lateralArea.toFixed(2)}` },
        { label: 'Volume', formula: 'Ab·h/3', calc: `${baseArea.toFixed(2)}·${p.h.toFixed(2)}/3 = ${(baseArea*p.h/3).toFixed(2)}` },
      ];
    },
    createGeometry: (p) => new THREE.ConeGeometry(p.a / Math.sqrt(2), p.h, 4),
    createPlanification: (p) => createPiramideQuadrangularPlanification(p.a, p.h),
  },
  piramide_pentagonal: {
    name: 'Pirâmide Pentagonal',
    type: 'polyhedron',
    params: { a: 1.5, h: 2.5 },
    paramDefs: [
      { key: 'a', label: 'Lado da base', min: 0.5, max: 4, step: 0.1 },
      { key: 'h', label: 'Altura', min: 0.5, max: 5, step: 0.1 },
    ],
    properties: (p) => {
      const { a, h } = p;
      const baseArea = (5 * a * a) / (4 * Math.tan(Math.PI / 5));
      const apothem = a / (2 * Math.tan(Math.PI / 5));
      const slantHeight = Math.sqrt(h * h + apothem * apothem);
      const lateralArea = 5 * (a * slantHeight / 2);
      return {
        'Lado da base (a)': a.toFixed(2),
        'Altura (h)': h.toFixed(2),
        'Faces': 6,
        'Arestas': 10,
        'Vértices': 6,
        'Área da base': baseArea.toFixed(2),
        'Área lateral': lateralArea.toFixed(2),
        'Área total': (baseArea + lateralArea).toFixed(2),
        'Volume': (baseArea * h / 3).toFixed(2),
      };
    },
    formulas: (p) => {
      const baseArea = (5 * p.a * p.a) / (4 * Math.tan(Math.PI / 5));
      const apothem = p.a / (2 * Math.tan(Math.PI / 5));
      const slantHeight = Math.sqrt(p.h * p.h + apothem * apothem);
      const lateralArea = 5 * (p.a * slantHeight / 2);
      return [
        { label: 'Área da base', formula: '5a²/(4·tan(π/5))', calc: `5·${p.a.toFixed(2)}²/(4·tan(π/5)) = ${baseArea.toFixed(2)}` },
        { label: 'Altura da face', formula: '√(h² + m²)', calc: `√(${p.h.toFixed(2)}² + ${apothem.toFixed(2)}²) = ${slantHeight.toFixed(2)}` },
        { label: 'Área lateral', formula: '5·(a·g/2)', calc: `5·(${p.a.toFixed(2)}·${slantHeight.toFixed(2)}/2) = ${lateralArea.toFixed(2)}` },
        { label: 'Volume', formula: 'Ab·h/3', calc: `${baseArea.toFixed(2)}·${p.h.toFixed(2)}/3 = ${(baseArea*p.h/3).toFixed(2)}` },
      ];
    },
    createGeometry: (p) => new THREE.ConeGeometry(p.a / (2 * Math.sin(Math.PI / 5)), p.h, 5),
    createPlanification: (p) => createPiramidePentagonalPlanification(p.a, p.h),
  },
  tetraedro: {
    name: 'Tetraedro',
    type: 'polyhedron',
    params: { a: 2 },
    paramDefs: [{ key: 'a', label: 'Aresta', min: 0.5, max: 5, step: 0.1 }],
    properties: (p) => {
      const a = p.a;
      const baseArea = (Math.sqrt(3) / 4) * a * a;
      const volume = (a * a * a) / (6 * Math.sqrt(2));
      return {
        'Aresta (a)': a.toFixed(2),
        'Faces': 4,
        'Arestas': 6,
        'Vértices': 4,
        'Área da face': baseArea.toFixed(2),
        'Área total': (4 * baseArea).toFixed(2),
        'Volume': volume.toFixed(2),
      };
    },
    formulas: (p) => {
      const baseArea = (Math.sqrt(3) / 4) * p.a * p.a;
      return [
        { label: 'Área da face', formula: '(√3/4)·a²', calc: `(√3/4)·${p.a.toFixed(2)}² = ${baseArea.toFixed(2)}` },
        { label: 'Área total', formula: '4·Af', calc: `4·${baseArea.toFixed(2)} = ${(4*baseArea).toFixed(2)}` },
        { label: 'Volume', formula: 'a³/(6√2)', calc: `${p.a.toFixed(2)}³/(6√2) = ${((p.a**3)/(6*Math.sqrt(2))).toFixed(2)}` },
      ];
    },
    createGeometry: (p) => new THREE.TetrahedronGeometry(p.a * 0.8),
    createPlanification: (p) => createTetraedroPlanification(p.a),
  },
  octaedro: {
    name: 'Octaedro',
    type: 'polyhedron',
    params: { a: 2 },
    paramDefs: [{ key: 'a', label: 'Aresta', min: 0.5, max: 5, step: 0.1 }],
    properties: (p) => {
      const a = p.a;
      const faceArea = (Math.sqrt(3) / 4) * a * a;
      const volume = (Math.sqrt(2) / 3) * a * a * a;
      return {
        'Aresta (a)': a.toFixed(2),
        'Faces': 8,
        'Arestas': 12,
        'Vértices': 6,
        'Área da face': faceArea.toFixed(2),
        'Área total': (8 * faceArea).toFixed(2),
        'Volume': volume.toFixed(2),
      };
    },
    formulas: (p) => {
      const faceArea = (Math.sqrt(3) / 4) * p.a * p.a;
      return [
        { label: 'Área da face', formula: '(√3/4)·a²', calc: `(√3/4)·${p.a.toFixed(2)}² = ${faceArea.toFixed(2)}` },
        { label: 'Área total', formula: '8·Af', calc: `8·${faceArea.toFixed(2)} = ${(8*faceArea).toFixed(2)}` },
        { label: 'Volume', formula: '(√2/3)·a³', calc: `(√2/3)·${p.a.toFixed(2)}³ = ${((Math.sqrt(2)/3)*p.a**3).toFixed(2)}` },
      ];
    },
    createGeometry: (p) => new THREE.OctahedronGeometry(p.a * 0.8),
    createPlanification: (p) => createOctaedroPlanification(p.a),
  },
  esfera: {
    name: 'Esfera',
    type: 'round',
    params: { r: 1.5 },
    paramDefs: [{ key: 'r', label: 'Raio', min: 0.5, max: 4, step: 0.1 }],
    properties: (p) => {
      const r = p.r;
      return {
        'Raio (r)': r.toFixed(2),
        'Faces': 1,
        'Arestas': 0,
        'Vértices': 0,
        'Área da superfície': (4 * Math.PI * r * r).toFixed(2),
        'Volume': (4/3 * Math.PI * r * r * r).toFixed(2),
      };
    },
    formulas: (p) => {
      const r = p.r;
      return [
        { label: 'Área da superfície', formula: '4πr²', calc: `4π·${r.toFixed(2)}² = ${(4*Math.PI*r*r).toFixed(2)}` },
        { label: 'Volume', formula: '4πr³/3', calc: `4π·${r.toFixed(2)}³/3 = ${((4/3)*Math.PI*r*r*r).toFixed(2)}` },
      ];
    },
    createGeometry: (p) => new THREE.SphereGeometry(p.r, 32, 32),
    createPlanification: (p) => createEsferaPlanification(p.r),
  },
  cilindro: {
    name: 'Cilindro',
    type: 'round',
    params: { r: 1.2, h: 2.5 },
    paramDefs: [
      { key: 'r', label: 'Raio', min: 0.5, max: 4, step: 0.1 },
      { key: 'h', label: 'Altura', min: 0.5, max: 5, step: 0.1 },
    ],
    properties: (p) => {
      const { r, h } = p;
      const baseArea = Math.PI * r * r;
      const lateralArea = 2 * Math.PI * r * h;
      return {
        'Raio (r)': r.toFixed(2),
        'Altura (h)': h.toFixed(2),
        'Faces': 3,
        'Arestas': 2,
        'Vértices': 0,
        'Área da base': baseArea.toFixed(2),
        'Área lateral': lateralArea.toFixed(2),
        'Área total': (2 * baseArea + lateralArea).toFixed(2),
        'Volume': (baseArea * h).toFixed(2),
      };
    },
    formulas: (p) => {
      const baseArea = Math.PI * p.r * p.r;
      const lateralArea = 2 * Math.PI * p.r * p.h;
      return [
        { label: 'Área da base', formula: 'πr²', calc: `π·${p.r.toFixed(2)}² = ${baseArea.toFixed(2)}` },
        { label: 'Área lateral', formula: '2πrh', calc: `2π·${p.r.toFixed(2)}·${p.h.toFixed(2)} = ${lateralArea.toFixed(2)}` },
        { label: 'Área total', formula: '2πr(r+h)', calc: `2π·${p.r.toFixed(2)}·(${p.r.toFixed(2)}+${p.h.toFixed(2)}) = ${(2*baseArea+lateralArea).toFixed(2)}` },
        { label: 'Volume', formula: 'πr²h', calc: `π·${p.r.toFixed(2)}²·${p.h.toFixed(2)} = ${(baseArea*p.h).toFixed(2)}` },
      ];
    },
    createGeometry: (p) => new THREE.CylinderGeometry(p.r, p.r, p.h, 32),
    createPlanification: (p) => createCilindroPlanification(p.r, p.h),
  },
  cone: {
    name: 'Cone',
    type: 'round',
    params: { r: 1.2, h: 2.5 },
    paramDefs: [
      { key: 'r', label: 'Raio', min: 0.5, max: 4, step: 0.1 },
      { key: 'h', label: 'Altura', min: 0.5, max: 5, step: 0.1 },
    ],
    properties: (p) => {
      const { r, h } = p;
      const baseArea = Math.PI * r * r;
      const slantHeight = Math.sqrt(r * r + h * h);
      const lateralArea = Math.PI * r * slantHeight;
      return {
        'Raio (r)': r.toFixed(2),
        'Altura (h)': h.toFixed(2),
        'Geratriz (g)': slantHeight.toFixed(2),
        'Faces': 2,
        'Arestas': 1,
        'Vértices': 1,
        'Área da base': baseArea.toFixed(2),
        'Área lateral': lateralArea.toFixed(2),
        'Área total': (baseArea + lateralArea).toFixed(2),
        'Volume': (baseArea * h / 3).toFixed(2),
      };
    },
    formulas: (p) => {
      const baseArea = Math.PI * p.r * p.r;
      const slantHeight = Math.sqrt(p.r * p.r + p.h * p.h);
      const lateralArea = Math.PI * p.r * slantHeight;
      return [
        { label: 'Área da base', formula: 'πr²', calc: `π·${p.r.toFixed(2)}² = ${baseArea.toFixed(2)}` },
        { label: 'Geratriz', formula: '√(r² + h²)', calc: `√(${p.r.toFixed(2)}² + ${p.h.toFixed(2)}²) = ${slantHeight.toFixed(2)}` },
        { label: 'Área lateral', formula: 'πrg', calc: `π·${p.r.toFixed(2)}·${slantHeight.toFixed(2)} = ${lateralArea.toFixed(2)}` },
        { label: 'Área total', formula: 'πr(r+g)', calc: `π·${p.r.toFixed(2)}·(${p.r.toFixed(2)}+${slantHeight.toFixed(2)}) = ${(baseArea+lateralArea).toFixed(2)}` },
        { label: 'Volume', formula: 'πr²h/3', calc: `π·${p.r.toFixed(2)}²·${p.h.toFixed(2)}/3 = ${(baseArea*p.h/3).toFixed(2)}` },
      ];
    },
    createGeometry: (p) => new THREE.ConeGeometry(p.r, p.h, 32),
    createPlanification: (p) => createConePlanification(p.r, p.h),
  },
  tronco_cone: {
    name: 'Tronco de Cone',
    type: 'round',
    params: { r1: 1.5, r2: 0.8, h: 2 },
    paramDefs: [
      { key: 'r1', label: 'Raio maior', min: 0.5, max: 4, step: 0.1 },
      { key: 'r2', label: 'Raio menor', min: 0.3, max: 3.5, step: 0.1 },
      { key: 'h', label: 'Altura', min: 0.5, max: 5, step: 0.1 },
    ],
    properties: (p) => {
      const { r1, r2, h } = p;
      const baseArea1 = Math.PI * r1 * r1;
      const baseArea2 = Math.PI * r2 * r2;
      const slantHeight = Math.sqrt(h * h + (r1 - r2) * (r1 - r2));
      const lateralArea = Math.PI * (r1 + r2) * slantHeight;
      return {
        'Raio maior (R)': r1.toFixed(2),
        'Raio menor (r)': r2.toFixed(2),
        'Altura (h)': h.toFixed(2),
        'Geratriz (g)': slantHeight.toFixed(2),
        'Faces': 3,
        'Arestas': 2,
        'Vértices': 0,
        'Área da base maior': baseArea1.toFixed(2),
        'Área da base menor': baseArea2.toFixed(2),
        'Área lateral': lateralArea.toFixed(2),
        'Área total': (baseArea1 + baseArea2 + lateralArea).toFixed(2),
        'Volume': ((Math.PI * h / 3) * (r1*r1 + r1*r2 + r2*r2)).toFixed(2),
      };
    },
    formulas: (p) => {
      const { r1, r2, h } = p;
      const slantHeight = Math.sqrt(h * h + (r1 - r2) * (r1 - r2));
      const lateralArea = Math.PI * (r1 + r2) * slantHeight;
      const baseArea1 = Math.PI * r1 * r1;
      const baseArea2 = Math.PI * r2 * r2;
      return [
        { label: 'Geratriz', formula: '√(h² + (R-r)²)', calc: `√(${h.toFixed(2)}² + (${r1.toFixed(2)}-${r2.toFixed(2)})²) = ${slantHeight.toFixed(2)}` },
        { label: 'Área lateral', formula: 'π(R+r)g', calc: `π(${r1.toFixed(2)}+${r2.toFixed(2)})·${slantHeight.toFixed(2)} = ${lateralArea.toFixed(2)}` },
        { label: 'Área total', formula: 'πR² + πr² + π(R+r)g', calc: `${baseArea1.toFixed(2)} + ${baseArea2.toFixed(2)} + ${lateralArea.toFixed(2)} = ${(baseArea1+baseArea2+lateralArea).toFixed(2)}` },
        { label: 'Volume', formula: '(πh/3)(R²+Rr+r²)', calc: `(π·${h.toFixed(2)}/3)·(${r1.toFixed(2)}²+${r1.toFixed(2)}·${r2.toFixed(2)}+${r2.toFixed(2)}²) = ${((Math.PI*h/3)*(r1*r1+r1*r2+r2*r2)).toFixed(2)}` },
      ];
    },
    createGeometry: (p) => new THREE.CylinderGeometry(p.r2, p.r1, p.h, 32),
    createPlanification: (p) => createTroncoConePlanification(p.r1, p.r2, p.h),
  },
};

// ============================================================
// 2. FUNÇÕES DE PLANIFICAÇÃO
// ============================================================

function createCubePlanification(a) {
  const s = a;
  const gap = 0.02;
  const positions = [
    [0, 0, 0], [s + gap, 0, 0], [s + gap, s + gap, 0],
    [-(s + gap), 0, 0], [0, s + gap, 0], [0, -(s + gap), 0],
  ];
  const group = new THREE.Group();
  positions.forEach(([x, y, z]) => {
    const geo = new THREE.PlaneGeometry(s, s);
    const mat = new THREE.MeshStandardMaterial({ color: '#3b82f6', side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    group.add(mesh);
  });
  return group;
}

function createParalelepipedoPlanification(a, b, c) {
  const gap = 0.05;
  const group = new THREE.Group();
  const add = (w, h, x, y) => {
    const geo = new THREE.PlaneGeometry(w, h);
    const mat = new THREE.MeshStandardMaterial({ color: '#3b82f6', side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, 0);
    group.add(mesh);
  };
  add(a, b, 0, 0);
  add(a, b, a + gap, 0);
  add(a, c, 0, b + gap);
  add(a, c, 0, -(c + gap));
  add(b, c, -(b + gap), 0);
  add(b, c, a + gap, 0);
  return group;
}

function createPrismaTriangularPlanification(a, h) {
  const gap = 0.05;
  const group = new THREE.Group();
  const triShape = (s) => {
    const shape = new THREE.Shape();
    const ht = Math.sqrt(3) / 2 * s;
    shape.moveTo(0, ht * 2/3);
    shape.lineTo(-s/2, -ht/3);
    shape.lineTo(s/2, -ht/3);
    shape.closePath();
    return shape;
  };
  const mat = new THREE.MeshStandardMaterial({ color: '#3b82f6', side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
  const t1 = new THREE.Mesh(new THREE.ShapeGeometry(triShape(a)), mat);
  group.add(t1);
  const t2 = new THREE.Mesh(new THREE.ShapeGeometry(triShape(a)), mat);
  t2.position.set(0, 0, h + gap);
  group.add(t2);
  for (let i = 0; i < 3; i++) {
    const rect = new THREE.Mesh(new THREE.PlaneGeometry(a, h), mat);
    const angle = (i / 3) * Math.PI * 2;
    const apothem = a / (2 * Math.sqrt(3));
    rect.position.set(Math.cos(angle) * apothem, Math.sin(angle) * apothem, h / 2);
    rect.rotation.z = angle + Math.PI / 2;
    group.add(rect);
  }
  return group;
}

function createPrismaHexagonalPlanification(a, h) {
  const gap = 0.05;
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#3b82f6', side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
  const hexGeo = new THREE.CircleGeometry(a, 6);
  const h1 = new THREE.Mesh(hexGeo, mat); h1.position.set(0, 0, 0); group.add(h1);
  const h2 = new THREE.Mesh(hexGeo, mat); h2.position.set(0, 0, h + gap); group.add(h2);
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const apothem = a * Math.sqrt(3) / 2;
    const rect = new THREE.Mesh(new THREE.PlaneGeometry(a, h), mat);
    rect.position.set(Math.cos(angle) * apothem, Math.sin(angle) * apothem, h / 2);
    rect.rotation.z = angle + Math.PI / 2;
    group.add(rect);
  }
  return group;
}

function createPiramideTriangularPlanification(a, h) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#3b82f6', side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
  const base = new THREE.Mesh(new THREE.CircleGeometry(a / Math.sqrt(3), 3), mat);
  base.rotation.x = -Math.PI / 2;
  group.add(base);
  const apothem = a / (2 * Math.sqrt(3));
  const slantHeight = Math.sqrt(h * h + apothem * apothem);
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2 + Math.PI / 2;
    const triShape = new THREE.Shape();
    triShape.moveTo(0, 0); triShape.lineTo(a, 0); triShape.lineTo(a / 2, slantHeight); triShape.closePath();
    const triMesh = new THREE.Mesh(new THREE.ShapeGeometry(triShape), mat);
    triMesh.position.set(Math.cos(angle) * apothem, 0, Math.sin(angle) * apothem);
    triMesh.rotation.y = -angle;
    group.add(triMesh);
  }
  return group;
}

function createPiramideQuadrangularPlanification(a, h) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#3b82f6', side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
  const base = new THREE.Mesh(new THREE.PlaneGeometry(a, a), mat);
  base.rotation.x = -Math.PI / 2;
  group.add(base);
  const apothem = a / 2;
  const slantHeight = Math.sqrt(h * h + apothem * apothem);
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const triShape = new THREE.Shape();
    triShape.moveTo(0, 0); triShape.lineTo(a, 0); triShape.lineTo(a / 2, slantHeight); triShape.closePath();
    const triMesh = new THREE.Mesh(new THREE.ShapeGeometry(triShape), mat);
    triMesh.position.set(Math.cos(angle) * apothem, 0, Math.sin(angle) * apothem);
    triMesh.rotation.y = -angle;
    group.add(triMesh);
  }
  return group;
}

function createPiramidePentagonalPlanification(a, h) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#3b82f6', side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
  const base = new THREE.Mesh(new THREE.CircleGeometry(a / (2 * Math.sin(Math.PI / 5)), 5), mat);
  base.rotation.x = -Math.PI / 2;
  group.add(base);
  const apothem = a / (2 * Math.tan(Math.PI / 5));
  const slantHeight = Math.sqrt(h * h + apothem * apothem);
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const triShape = new THREE.Shape();
    triShape.moveTo(0, 0); triShape.lineTo(a, 0); triShape.lineTo(a / 2, slantHeight); triShape.closePath();
    const triMesh = new THREE.Mesh(new THREE.ShapeGeometry(triShape), mat);
    triMesh.position.set(Math.cos(angle) * apothem, 0, Math.sin(angle) * apothem);
    triMesh.rotation.y = -angle;
    group.add(triMesh);
  }
  return group;
}

function createTetraedroPlanification(a) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#3b82f6', side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
  const s = a;
  const h = Math.sqrt(3) / 2 * s;
  const baseShape = new THREE.Shape();
  baseShape.moveTo(0, h * 2/3); baseShape.lineTo(-s/2, -h/3); baseShape.lineTo(s/2, -h/3); baseShape.closePath();
  const base = new THREE.Mesh(new THREE.ShapeGeometry(baseShape), mat);
  base.rotation.x = -Math.PI / 2;
  group.add(base);
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2 + Math.PI / 2;
    const triShape = new THREE.Shape();
    triShape.moveTo(0, 0); triShape.lineTo(s, 0); triShape.lineTo(s/2, h); triShape.closePath();
    const triMesh = new THREE.Mesh(new THREE.ShapeGeometry(triShape), mat);
    triMesh.position.set(Math.cos(angle) * s/3, 0, Math.sin(angle) * s/3);
    triMesh.rotation.y = -angle;
    group.add(triMesh);
  }
  return group;
}

function createOctaedroPlanification(a) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#3b82f6', side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
  const s = a;
  const h = Math.sqrt(3) / 2 * s;
  for (let i = 0; i < 4; i++) {
    const triShape = new THREE.Shape();
    triShape.moveTo(0, 0); triShape.lineTo(s, 0); triShape.lineTo(s/2, h); triShape.closePath();
    const triMesh = new THREE.Mesh(new THREE.ShapeGeometry(triShape), mat);
    const angle = (i / 4) * Math.PI * 2;
    triMesh.position.set(Math.cos(angle) * s/2, 0, Math.sin(angle) * s/2);
    triMesh.rotation.y = -angle;
    group.add(triMesh);
  }
  for (let i = 0; i < 4; i++) {
    const triShape = new THREE.Shape();
    triShape.moveTo(0, 0); triShape.lineTo(s, 0); triShape.lineTo(s/2, -h); triShape.closePath();
    const triMesh = new THREE.Mesh(new THREE.ShapeGeometry(triShape), mat);
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
    triMesh.position.set(Math.cos(angle) * s/2, 0, Math.sin(angle) * s/2);
    triMesh.rotation.y = -angle;
    group.add(triMesh);
  }
  return group;
}

function createEsferaPlanification(r) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#3b82f6', side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
  group.add(new THREE.Mesh(new THREE.CircleGeometry(r, 32), mat));
  const inner = new THREE.Mesh(new THREE.RingGeometry(r * 0.3, r * 0.5, 32), mat);
  inner.rotation.x = -Math.PI / 2;
  group.add(inner);
  return group;
}

function createCilindroPlanification(r, h) {
  const gap = 0.05;
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#3b82f6', side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
  const c1 = new THREE.Mesh(new THREE.CircleGeometry(r, 32), mat);
  c1.rotation.x = -Math.PI / 2; c1.position.y = h / 2 + gap; group.add(c1);
  const c2 = new THREE.Mesh(new THREE.CircleGeometry(r, 32), mat);
  c2.rotation.x = -Math.PI / 2; c2.position.y = -h / 2 - gap; group.add(c2);
  const rect = new THREE.Mesh(new THREE.PlaneGeometry(2 * Math.PI * r, h), mat);
  rect.rotation.x = -Math.PI / 2;
  group.add(rect);
  return group;
}

function createConePlanification(r, h) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#3b82f6', side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
  const circle = new THREE.Mesh(new THREE.CircleGeometry(r, 32), mat);
  circle.rotation.x = -Math.PI / 2;
  group.add(circle);
  const slantHeight = Math.sqrt(r * r + h * h);
  const sectorAngle = 2 * Math.PI * r / slantHeight;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.arc(0, 0, slantHeight, 0, sectorAngle);
  shape.closePath();
  const sector = new THREE.Mesh(new THREE.ShapeGeometry(shape), mat);
  sector.position.y = 0.5;
  group.add(sector);
  return group;
}

function createTroncoConePlanification(r1, r2, h) {
  const gap = 0.05;
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#3b82f6', side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
  const c1 = new THREE.Mesh(new THREE.CircleGeometry(r1, 32), mat);
  c1.rotation.x = -Math.PI / 2; c1.position.y = h / 2 + gap; group.add(c1);
  const c2 = new THREE.Mesh(new THREE.CircleGeometry(r2, 32), mat);
  c2.rotation.x = -Math.PI / 2; c2.position.y = -h / 2 - gap; group.add(c2);
  const slantHeight = Math.sqrt(h * h + (r1 - r2) * (r1 - r2));
  const shape = new THREE.Shape();
  shape.moveTo(0, 0); shape.lineTo(r2, 0); shape.lineTo(r1, slantHeight); shape.lineTo(0, slantHeight); shape.closePath();
  group.add(new THREE.Mesh(new THREE.ShapeGeometry(shape), mat));
  return group;
}

// ============================================================
// 3. APLICAÇÃO PRINCIPAL
// ============================================================

class GeoVisionApp {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#f5f7fa');

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    this.camera.position.set(4, 3, 6);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 1.0;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 20;

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.labelRenderer.domElement.style.position = 'absolute';
    this.labelRenderer.domElement.style.top = '0';
    this.labelRenderer.domElement.style.pointerEvents = 'none';
    this.container.appendChild(this.labelRenderer.domElement);

    // Luzes
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(5, 10, 7);
    dir.castShadow = true;
    this.scene.add(dir);
    const fill = new THREE.DirectionalLight(0xffffff, 0.3);
    fill.position.set(-5, 0, 5);
    this.scene.add(fill);

    this.gridHelper = new THREE.GridHelper(20, 20, 0xe2e8f0, 0xe2e8f0);
    this.gridHelper.position.y = -1.5;
    this.scene.add(this.gridHelper);

    // Estado
    this.currentFigureKey = 'cube';
    this.params = { ...FIGURES.cube.params };
    this.mesh = null;
    this.planificationMesh = null;
    this.isPlanified = false;
    this.planifyProgress = 0;
    this.planifySpeed = 1.5;
    this.isAnimating = false;
    this.animationDirection = 0;
    this.animationTarget = 0;
    this.handRotation = { x: 0, y: 0 };
    this.gestureDetected = false;
    this.hands = null;
    this.cameraStream = null;
    this.mediaPipeCamera = null;

    this.initUI();
    this.loadFigure('cube');
    this.animate();
    this.onResize();

    window.addEventListener('resize', () => this.onResize());
  }

  initUI() {
    const polyList = document.getElementById('polyhedra-list');
    const roundList = document.getElementById('round-list');

    Object.entries(FIGURES).forEach(([key, fig]) => {
      if (fig.type !== 'polyhedron') return;
      const item = document.createElement('div');
      item.className = 'figure-item' + (key === this.currentFigureKey ? ' active' : '');
      item.dataset.key = key;
      item.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>${fig.name}`;
      item.addEventListener('click', () => this.loadFigure(key));
      polyList.appendChild(item);
    });

    Object.entries(FIGURES).forEach(([key, fig]) => {
      if (fig.type !== 'round') return;
      const item = document.createElement('div');
      item.className = 'figure-item' + (key === this.currentFigureKey ? ' active' : '');
      item.dataset.key = key;
      item.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>${fig.name}`;
      item.addEventListener('click', () => this.loadFigure(key));
      roundList.appendChild(item);
    });

    document.getElementById('btn-reset-view').addEventListener('click', () => {
      this.controls.autoRotate = true;
      this.controls.target.set(0, 0, 0);
      this.camera.position.set(4, 3, 6);
      this.controls.update();
    });

    document.getElementById('btn-presentation').addEventListener('click', () => {
      document.body.classList.toggle('presentation-mode');
      setTimeout(() => this.onResize(), 100);
    });

    const planifySlider = document.getElementById('planify-slider');
    const planifyValue = document.getElementById('planify-value');
    const speedSlider = document.getElementById('speed-slider');
    const speedValue = document.getElementById('speed-value');

    planifySlider.addEventListener('input', (e) => {
      this.planifyProgress = parseFloat(e.target.value);
      planifyValue.textContent = Math.round(this.planifyProgress * 100) + '%';
      this.updatePlanification();
      this.isPlanified = this.planifyProgress > 0;
      this.controls.autoRotate = !this.isPlanified;
    });

    speedSlider.addEventListener('input', (e) => {
      this.planifySpeed = parseFloat(e.target.value);
      speedValue.textContent = this.planifySpeed.toFixed(1) + 'x';
    });

    document.getElementById('btn-planify').addEventListener('click', () => this.startPlanification(1));
    document.getElementById('btn-remount').addEventListener('click', () => this.startPlanification(0));

    document.getElementById('btn-camera').addEventListener('click', () => this.openCameraModal());
    document.getElementById('btn-close-camera').addEventListener('click', () => this.closeCameraModal());
    document.getElementById('btn-start-camera').addEventListener('click', () => this.startCamera());
    document.getElementById('btn-stop-camera').addEventListener('click', () => this.stopCamera());

    planifyValue.textContent = '0%';
    speedValue.textContent = '1.5x';
  }

  loadFigure(key) {
    const fig = FIGURES[key];
    if (!fig) return;

    this.currentFigureKey = key;
    this.params = { ...fig.params };
    this.isPlanified = false;
    this.planifyProgress = 0;
    this.controls.autoRotate = true;

    document.querySelectorAll('.figure-item').forEach(el => {
      el.classList.toggle('active', el.dataset.key === key);
    });
    document.getElementById('status-figure').textContent = fig.name;
    document.getElementById('planify-slider').value = 0;
    document.getElementById('planify-value').textContent = '0%';

    // Remover planificação ativa
    if (this.planificationMesh) {
      this.scene.remove(this.planificationMesh);
      this.planificationMesh.traverse(c => {
        if (c.geometry) c.geometry.dispose();
        if (c.material) c.material.dispose();
      });
      this.planificationMesh = null;
    }

    this.buildScene();
    this.updateProperties();
    this.updateDimensions();
  }

  buildScene() {
    const fig = FIGURES[this.currentFigureKey];
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.traverse(c => {
        if (c.geometry) c.geometry.dispose();
        if (c.material) c.material.dispose();
      });
      this.mesh = null;
    }

    const geometry = fig.createGeometry(this.params);
    const material = new THREE.MeshStandardMaterial({
      color: '#3b82f6',
      metalness: 0.1,
      roughness: 0.35,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.scene.add(this.mesh);

    if (fig.type === 'polyhedron') {
      const edges = new THREE.EdgesGeometry(geometry);
      this.mesh.add(new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: '#0b2b4f' })));
    }

    this.controls.target.set(0, 0, 0);
    this.camera.position.set(4, 3, 6);
    this.controls.update();
  }

  updatePlanification() {
    const fig = FIGURES[this.currentFigureKey];

    if (this.planificationMesh) {
      this.scene.remove(this.planificationMesh);
      this.planificationMesh.traverse(c => {
        if (c.geometry) c.geometry.dispose();
        if (c.material) c.material.dispose();
      });
      this.planificationMesh = null;
    }

    if (this.planifyProgress <= 0) {
      if (this.mesh) this.mesh.visible = true;
      return;
    }

    if (this.mesh) this.mesh.visible = false;

    const planification = fig.createPlanification(this.params);
    this.planificationMesh = planification;
    this.scene.add(planification);

    planification.traverse(c => {
      if (c.material) c.material.opacity = 0.5 + 0.35 * this.planifyProgress;
    });
  }

  startPlanification(target) {
    this.isAnimating = true;
    this.animationDirection = target > this.planifyProgress ? 1 : -1;
    this.animationTarget = target;
    this.controls.autoRotate = false;
  }

  updateProperties() {
    const fig = FIGURES[this.currentFigureKey];
    const container = document.getElementById('properties-container');
    const props = fig.properties(this.params);
    const formulas = fig.formulas(this.params);

    container.innerHTML =
      Object.entries(props).map(([k, v]) =>
        `<div class="property-row"><span class="property-label">${k}</span><span class="property-value">${v}</span></div>`
      ).join('') +
      `<div style="margin-top:8px;">` +
      formulas.map(f =>
        `<div class="property-row" style="flex-direction:column;align-items:flex-start;padding:4px 0;">
          <div style="display:flex;justify-content:space-between;width:100%;gap:8px;">
            <span class="property-label">${f.label}</span>
            <span class="property-formula">${f.formula}</span>
          </div>
          <div class="property-formula" style="font-size:11px;color:#64748b;margin-top:1px;">${f.calc}</div>
        </div>`
      ).join('') +
      `</div>`;
  }

  updateDimensions() {
    const fig = FIGURES[this.currentFigureKey];
    const container = document.getElementById('dimensions-container');
    container.innerHTML = '';

    fig.paramDefs.forEach(def => {
      const row = document.createElement('div');
      row.className = 'dimension-row';
      row.innerHTML = `
        <span class="dimension-label">${def.label}</span>
        <input type="number" class="dimension-input" data-key="${def.key}" value="${this.params[def.key].toFixed(1)}" min="${def.min}" max="${def.max}" step="${def.step}">
      `;
      const input = row.querySelector('input');
      input.addEventListener('change', (e) => {
        let val = parseFloat(e.target.value);
        if (isNaN(val)) val = def.min;
        val = Math.max(def.min, Math.min(def.max, val));
        e.target.value = val.toFixed(1);
        this.params[def.key] = val;
        this.buildScene();
        this.updateProperties();
        if (this.isPlanified) this.updatePlanification();
      });
      container.appendChild(row);
    });
  }

  onResize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.labelRenderer.setSize(w, h);
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    if (this.isAnimating) {
      const step = 0.02 * this.planifySpeed;
      this.planifyProgress += this.animationDirection * step;
      if (this.animationDirection > 0) {
        this.planifyProgress = Math.min(this.planifyProgress, this.animationTarget);
        if (this.planifyProgress >= this.animationTarget) this.isAnimating = false;
      } else {
        this.planifyProgress = Math.max(this.planifyProgress, this.animationTarget);
        if (this.planifyProgress <= this.animationTarget) this.isAnimating = false;
      }
      document.getElementById('planify-slider').value = this.planifyProgress;
      document.getElementById('planify-value').textContent = Math.round(this.planifyProgress * 100) + '%';
      this.updatePlanification();
      this.isPlanified = this.planifyProgress > 0.01;
    }

    if (this.mesh && this.gestureDetected) {
      this.mesh.rotation.y += this.handRotation.x * 0.03;
      this.mesh.rotation.x += this.handRotation.y * 0.03;
    }

    if (this.planificationMesh) {
      this.planificationMesh.rotation.y += 0.002;
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
  }

  // ============================================================
  // CÂMERA E MEDIAPIPE (usa window.Hands / window.Camera globais)
  // ============================================================

  openCameraModal() {
    document.getElementById('camera-modal').classList.add('active');
  }

  closeCameraModal() {
    document.getElementById('camera-modal').classList.remove('active');
  }

  async startCamera() {
    const statusEl = document.getElementById('camera-status');
    const video = document.getElementById('webcam');
    const canvas = document.getElementById('gesture-canvas');

    if (typeof window.Hands === 'undefined' || typeof window.Camera === 'undefined') {
      statusEl.innerHTML = '<span class="status-dot" style="background:#dc2626;"></span> MediaPipe não carregou. Recarregue a página.';
      return;
    }

    try {
      statusEl.innerHTML = '<div class="spinner"></div> Inicializando câmera...';

      this.cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 }
      });
      video.srcObject = this.cameraStream;
      await video.play();

      const hands = new window.Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${file}`,
      });

      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.7,
      });

      const camera = new window.Camera(video, {
        onFrame: async () => { await hands.send({ image: video }); },
        width: 640,
        height: 480,
      });
      camera.start();

      hands.onResults((results) => {
        const ctx = canvas.getContext('2d');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
          const lm = results.multiHandLandmarks[0];

          ctx.fillStyle = '#3b82f6';
          ctx.strokeStyle = '#1e4b7a';
          ctx.lineWidth = 2;
          for (let i = 0; i < lm.length; i++) {
            ctx.beginPath();
            ctx.arc(lm[i].x * canvas.width, lm[i].y * canvas.height, 4, 0, Math.PI * 2);
            ctx.fill();
          }
          const connections = [
            [0,1],[1,2],[2,3],[3,4],
            [0,5],[5,6],[6,7],[7,8],
            [5,9],[9,10],[10,11],[11,12],
            [9,13],[13,14],[14,15],[15,16],
            [13,17],[17,18],[18,19],[19,20],
            [0,17]
          ];
          ctx.beginPath();
          connections.forEach(([a, b]) => {
            ctx.moveTo(lm[a].x * canvas.width, lm[a].y * canvas.height);
            ctx.lineTo(lm[b].x * canvas.width, lm[b].y * canvas.height);
          });
          ctx.stroke();

          this.handRotation.x = (lm[0].x - 0.5) * 2;
          this.handRotation.y = (lm[0].y - 0.5) * 2;
          this.gestureDetected = true;

          const thumbTip = lm[4];
          const indexTip = lm[8];
          const dist = Math.sqrt(
            Math.pow(thumbTip.x - indexTip.x, 2) +
            Math.pow(thumbTip.y - indexTip.y, 2)
          );
          if (this.mesh) {
            this.mesh.material.color.set(dist < 0.05 ? '#60a5fa' : '#3b82f6');
          }

          statusEl.innerHTML = '<span class="status-dot" style="background:#22c55e;"></span> Mão detectada — mova para rotacionar';
        } else {
          this.gestureDetected = false;
          statusEl.innerHTML = '<span class="status-dot off"></span> Mão não visível';
        }
      });

      this.hands = hands;
      this.mediaPipeCamera = camera;

      statusEl.innerHTML = '<span class="status-dot" style="background:#22c55e;"></span> Câmera ativa — aguardando mão';

      document.getElementById('btn-start-camera').disabled = true;
      const dot = document.getElementById('status-camera');
      dot.classList.remove('off');
      dot.style.background = '#22c55e';

    } catch (err) {
      console.error('Erro na câmera:', err);
      statusEl.innerHTML = `<span class="status-dot" style="background:#dc2626;"></span> Erro: ${err.message || 'Permissão negada'}`;
    }
  }

  stopCamera() {
    if (this.mediaPipeCamera) {
      try { this.mediaPipeCamera.stop(); } catch (e) {}
      this.mediaPipeCamera = null;
    }
    if (this.hands) {
      try { this.hands.close(); } catch (e) {}
      this.hands = null;
    }
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach(t => t.stop());
      this.cameraStream = null;
    }
    const video = document.getElementById('webcam');
    if (video.srcObject) {
      video.srcObject.getTracks().forEach(t => t.stop());
      video.srcObject = null;
    }
    this.gestureDetected = false;

    document.getElementById('camera-status').innerHTML = '<span class="status-dot off"></span> Câmera desligada';
    document.getElementById('btn-start-camera').disabled = false;

    const dot = document.getElementById('status-camera');
    dot.classList.add('off');
    dot.style.background = '';

    const canvas = document.getElementById('gesture-canvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

// ============================================================
// INICIALIZAÇÃO
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('loading-overlay');
  try {
    window.app = new GeoVisionApp();
    requestAnimationFrame(() => {
      setTimeout(() => {
        if (overlay) overlay.classList.add('hidden');
      }, 300);
    });
  } catch (err) {
    console.error('Erro ao inicializar:', err);
    if (overlay) {
      overlay.innerHTML = `
        <div style="color:#dc2626;padding:20px;text-align:center;font-family:inherit;">
          <strong>Erro ao carregar</strong><br>
          <span style="font-size:12px;">${err.message}</span>
        </div>`;
    }
  }
});
