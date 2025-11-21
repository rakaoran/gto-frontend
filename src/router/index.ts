// src/router/index.ts
import { createRouter, createWebHistory } from 'vue-router'

// You can define components directly here or import them from a 'views' folder
const Home = { template: '<div>Home Page</div>' }
const About = { template: '<div>About Page</div>' }

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: Home
    },
    {
      path: '/about',
      name: 'about',
      component: About
    }
  ]
})

export default router