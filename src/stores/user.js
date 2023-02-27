import { collection, doc, getDoc, getDocs, runTransaction, setDoc } from '@firebase/firestore'
import { getAdditionalUserInfo, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth'
import { defineStore } from 'pinia'
import { LocalStorage } from 'quasar'
import sha1 from 'sha1'
import { auth, db } from 'src/firebase'

export const useUserStore = defineStore('user', {
  state: () => ({
    _user: {},
    _userIp: '',
    _users: [],
    _isLoading: false
  }),

  persist: true,

  getters: {
    getUser: (state) => state._user,
    getUserIp: (state) => state._userIp,
    getUserIpHash: (state) => sha1(state._userIp),
    getUserRef: (getters) => doc(db, 'users', getters.getUser.uid),
    getUsers: (state) => state._users,
    isAdmin: (getters) => getters.getUser.role === 'Admin',
    isAuthenticated: (getters) => Boolean(getters.getUser?.uid),
    isLoading: (state) => state._isLoading
  },
  actions: {
    async fetchUsers() {
      this._isLoading = true
      await getDocs(collection(db, 'users'))
        .then((querySnapshot) => {
          const users = querySnapshot.docs.map((doc) => ({ uid: doc.id, ...doc.data() }))
          this.$patch({ _users: users })
        })
        .finally(() => (this._isLoading = false))
    },

    /**
     * Fetch the user ip from Cloudflare
     * @SaveState <string> IPV6
     */
    async fetchUserIp() {
      await fetch('https://www.cloudflare.com/cdn-cgi/trace')
        .then((res) => res.text())
        .then((text) => {
          text.split('\n').forEach((line) => {
            const [key, value] = line.split('=')
            if (key === 'ip') {
              this._userIp = value
            }
          })
        })
    },

    async googleSignIn() {
      const provider = new GoogleAuthProvider()

      this._isLoading = true
      await signInWithPopup(auth, provider)
        .then(async (result) => {
          const isNewUser = getAdditionalUserInfo(result)?.isNewUser
          const { email, displayName, photoURL, uid } = result.user

          if (isNewUser) {
            await setDoc(doc(db, 'users', uid), { email, displayName, photoURL })
          }

          await getDoc(doc(db, 'users', result.user.uid)).then((document) => {
            this.$patch({ _user: { uid: document.id, ...document.data() } })
          })
        })
        .finally(() => (this._isLoading = false))
    },

    async updateProfile(user) {
      this._isLoading = true
      await runTransaction(db, async (transaction) => {
        transaction.update(doc(db, 'users', this.getUser.uid), user)
      })
        .then(() => this.$patch({ _user: { ...this.getUser, ...user } }))
        .finally(() => (this._isLoading = false))
    },

    async updateRole(user) {
      this._isLoading = true
      await runTransaction(db, async (transaction) => {
        transaction.update(doc(db, 'users', user.uid), user)
      })
        .then(() => {
          const users = this.getUsers
          const index = users.findIndex((u) => u.uid === user.uid)
          users[index].role = user.role
          this.$patch({ _users: users })
        })
        .finally(() => (this._isLoading = false))
    },

    logout() {
      const userStore = useUserStore()
      signOut(auth).then(() => {
        userStore.$reset()
        LocalStorage.remove('user')
        this.router.go(0)
      })
    }
  }
})
