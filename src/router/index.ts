import { createRouter, createWebHistory } from 'vue-router'

// Import the views
import HomeView from '../views/HomeView.vue'
import LoginView from '../views/LoginView.vue'
import SignUpView from '../views/SignUpView.vue'
import GameView from '../views/GameView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView
    },
    {
      path: '/signup',
      name: 'signup',
      component: SignUpView
    },
    {
      path: '/game',
      name: 'game',
      component: GameView
    },
    // New route for joining by link
    {
      path: '/join/:gameId',
      name: 'joinGame',
      component: GameView
    }
  ]
})

export default router