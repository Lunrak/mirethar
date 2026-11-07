# Mirethar - Motor de Reglas y Combate para Juego de Rol

Un motor de reglas y combate para un juego de rol (RPG) de mesa, implementado como una aplicación móvil. Este proyecto es una demostración de arquitectura de software, lógica de negocio compleja y pruebas unitarias, llevando las mecánicas de un juego de rol a un entorno digital interactivo.

## 🎯 Propósito del Proyecto

El objetivo principal fue crear un motor de reglas robusto y extensible para un sistema de combate de un juego de rol. El proyecto se centró en la correcta implementación de las mecánicas del juego (tiradas de dados, modificadores, turnos, estados) y en garantizar su correctitud a través de pruebas unitarias. Es un ejemplo de cómo estructurar lógica de negocio compleja en una aplicación móvil.

## ✨ Características Principales

- **Motor de Combate**: Implementación de reglas de combate por turnos, incluyendo iniciativa, ataques, defensa, daño y habilidades especiales.
- **Gestión de Personajes y Equipos**: Creación y gestión de personajes con sus atributos y equipamiento.
- **Lógica de Dados**: Sistema de tiradas de dados con modificadores y reglas especiales.
- **Interfaz de Usuario (UI)**: Interfaz en modo horizontal (landscape) que simula una mesa de juego, con un dado central y feedback visual para las acciones.
- **Pruebas Unitarias**: El motor de reglas está cubierto por pruebas unitarias para asegurar que las mecánicas del juego funcionen según lo especificado.

## 🛠️ Stack Tecnológico

- **Framework**: React Native con Expo
- **Lenguaje**: TypeScript
- **Pruebas**: Jest con `jest-expo`
- **UI**: Componentes personalizados para simular dados y fichas de personaje.

## 🚀 Cómo Probar

1.  Clona el repositorio: `git clone https://github.com/Lunrak/mirethar.git`
2.  Instala las dependencias: `npm install`
3.  **Para jugar**: Inicia el servidor de desarrollo con `npx expo start` y abre la app en **Expo Go** (se recomienda un dispositivo físico en modo horizontal).
4.  **Para ejecutar las pruebas**: Ejecuta `npm test` para correr la suite de pruebas unitarias del motor de reglas.

## 💡 Aspectos Técnicos a Destacar

- **Lógica de Negocio Compleja**: La implementación de un motor de reglas de un RPG demuestra la capacidad de modelar sistemas complejos con múltiples interacciones y estados.
- **Testing y Calidad de Código**: La inclusión de Jest y `jest-expo` para probar el motor de reglas es un diferenciador clave. Demuestra un compromiso con la calidad del software y la corrección de la lógica de negocio.
- **Arquitectura Limpia**: La separación entre la lógica del motor de reglas (testeable) y la interfaz de usuario (React Native) es un ejemplo de buenas prácticas de arquitectura de software.
