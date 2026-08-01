# VRUTAL OS — Glossary

Versión: 0.1.0

---

# Propósito

Este documento define el lenguaje oficial de Vrutal.

Todo documento, desarrollo, propuesta comercial o conversación técnica utilizará estos términos con el mismo significado.

Un lenguaje común reduce la complejidad y evita ambigüedades.

---

# LAB

Unidad funcional independiente del ecosistema Vrutal.

Cada LAB desarrolla un área concreta del sistema.

Ejemplos:

- LAB00 → Gobierno y documentación.
- LAB01 → Framework WordPress.
- LAB02 → Plugins.
- LAB03 → Automatizaciones.
- LAB04 → Agentes IA.

---

# Vrutal OS

Sistema operativo organizacional de Vrutal.

Define la filosofía, las normas, la arquitectura y los procesos que rigen todo el ecosistema.

Es el núcleo del proyecto.

---

# Framework

Conjunto de herramientas reutilizables sobre las que se construyen nuevos proyectos.

Ejemplo:

LAB01 es el framework oficial para WordPress.

---

# Design System

Sistema visual compuesto por:

- colores
- tipografía
- espaciados
- componentes
- iconografía
- reglas de diseño

Su objetivo es garantizar consistencia entre todos los productos Vrutal.

---

# Design Tokens

Variables que representan decisiones de diseño.

Ejemplos:

--vr-color-primary

--vr-space-6

--vr-radius-lg

Nunca se utilizan valores directos cuando existe un token.

---

# Component

Elemento reutilizable que resuelve una única necesidad.

Ejemplos:

Hero

CTA

Card

Pricing

FAQ

Timeline

Footer

Header

---

# Block

Bloque reutilizable de Gutenberg desarrollado por Vrutal.

Puede estar compuesto por uno o varios componentes.

---

# Module

Conjunto de componentes relacionados que resuelven un proceso completo.

Ejemplo:

Sistema de Blog.

Sistema de Formularios.

Sistema de Landing Pages.

---

# Experiment

Nueva funcionalidad desarrollada y validada antes de incorporarse al framework principal.

Todo experimento debe estar documentado.

---

# Protocol

Procedimiento oficial para ejecutar una tarea.

Ejemplos:

Protocolo de despliegue.

Protocolo de copia de seguridad.

Protocolo de revisión de código.

---

# Agent

Sistema autónomo basado en inteligencia artificial con un objetivo específico.

Ejemplos:

Agente Comercial.

Agente SEO.

Agente Financiero.

Agente de Atención al Cliente.

---

# Automation

Proceso automático que elimina tareas manuales.

Puede involucrar IA, APIs o herramientas como n8n.

---

# Workflow

Secuencia ordenada de acciones que producen un resultado.

Un workflow puede incluir personas, sistemas y agentes.

---

# Deployment

Proceso mediante el cual una nueva versión pasa a producción.

Debe ser repetible y documentado.

---

# Sprint

Periodo corto de desarrollo con un objetivo definido y entregables concretos.

Cada Sprint genera una nueva versión del proyecto.

---

# Release

Versión estable del sistema preparada para su uso.

Ejemplo:

v0.1.0

v0.2.0

v1.0.0

---

# Changelog

Registro cronológico de todas las modificaciones realizadas en el proyecto.

Nunca se elimina información del historial.

---

# Knowledge Base

Repositorio centralizado de conocimiento del ecosistema Vrutal.

Incluye documentación, protocolos, decisiones y aprendizajes.

---

# Single Source of Truth (SSOT)

Principio según el cual cada dato debe tener una única fuente oficial.

Toda información duplicada genera riesgo de inconsistencias.

---

# Core

Núcleo de un sistema.

Contiene únicamente las funcionalidades esenciales.

Todo lo demás debe ser modular.

---

# Plugin

Módulo independiente que amplía las capacidades del Core sin modificarlo.

---

# Debt (Technical Debt)

Complejidad aceptada temporalmente para acelerar el desarrollo.

Toda deuda técnica debe registrarse y planificarse para su eliminación.

---

# Principle

Regla permanente que guía la toma de decisiones.

Los principios no cambian por necesidades puntuales.

---

# Standard

Norma técnica obligatoria para garantizar calidad y consistencia.

Todo desarrollo debe cumplir los estándares definidos en LAB00.

---

# Ecosystem

Conjunto de LABs, herramientas, procesos y agentes que forman Vrutal.

Cada elemento debe poder evolucionar sin comprometer el resto del sistema.

---

# Definición de éxito

Una solución Vrutal se considera completa cuando cumple estos criterios:

- Está documentada.
- Es reutilizable.
- Es escalable.
- Es mantenible.
- Es segura.
- Puede evolucionar sin romper el sistema.