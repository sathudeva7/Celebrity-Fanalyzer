import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  setDoc,
  Timestamp,
  updateDoc,
  where
} from 'firebase/firestore'
import { defineStore } from 'pinia'
import { db } from 'src/firebase'
import { useUserStore } from 'src/stores'

export const useCommentStore = defineStore('comments', {
  state: () => ({
    _comments: [],
    _childcomments: [],
    _isLoading: false
  }),

  persist: true,

  getters: {
    getComments: (state) => state._comments,
    getChildComments: (state) => state._childcomments,
    isLoading: (state) => state._isLoading
  },

  actions: {
    async fetchComments(slug) {
      this._isLoading = true
      const querySnapshot = await getDocs(query(collection(db, 'entries'), where('slug', '==', slug)))
      const entry = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))[0]

      const c = query(collection(db, 'entries', entry.id, 'comments'))
      const snap = await getDocs(c)
      const comments = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))

      for (const comment of comments) {
        if (!comment.isAnonymous) {
          comment.author = await getDoc(comment.author).then((doc) => doc.data())
        }
      }
      this._isLoading = false

      this._comments = comments
    },

    async fetchCommentsByparentId(slug, parentId) {
      this._isLoading = true
      const querySnapshot = await getDocs(query(collection(db, 'entries'), where('slug', '==', slug)))
      const entry = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))[0]

      const c = query(collection(db, 'entries', entry.id, 'comments'), where('parentId', '==', parentId))
      const snap = await getDocs(c)
      const comments = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))

      for (const comment of comments) {
        if (!comment.isAnonymous) {
          comment.author = await getDoc(comment.author).then((doc) => doc.data())
        }
      }
      this._isLoading = false

      this._childcomments = comments
    },

    async addComment(comment, entry) {
      const userStore = useUserStore()
      await userStore.fetchUserIp()

      comment.author = userStore.getUserRef || userStore.getUserIpHash
      comment.created = Timestamp.fromDate(new Date())
      comment.isAnonymous = !userStore.isAuthenticated

      const stateAuthor = Object.keys(userStore.getUser).length ? userStore.getUser : userStore.getUserIpHash
      const docId = Date.now() + '-' + (comment.author.id || comment.author)

      comment.id = docId

      this._isLoading = true
      await setDoc(doc(db, 'entries', entry.id, 'comments', docId), comment)
        .then(() => this.$patch({ _comments: [...this._comments, { ...comment, author: stateAuthor }] }))
        .catch((err) => {
          console.log(err)
          throw new Error(err)
        })
        .finally(() => (this._isLoading = false))
    },

    async editComment(entryId, id, editedComment, userId) {
      const userStore = useUserStore()
      await userStore.fetchUserIp()

      const comment = this.getComments.find((comment) => comment.id === id)
      const index = this._comments.findIndex((comment) => comment.id === id)

      comment.updated = Timestamp.fromDate(new Date())

      this._isLoading = true
      if (index !== -1 && userId === (comment.author?.uid || comment.author)) {
        await runTransaction(db, async (transaction) => {
          transaction.update(doc(db, 'entries', entryId, 'comments', comment.id), { text: editedComment })
        })
          .then(() => {
            this.$patch({
              _comments: [...this._comments.slice(0, index), { ...this._comments[index], ...comment }, ...this._comments.slice(index + 1)]
            })
          })
          .catch((error) => {
            console.error(error)
            throw new Error(error)
          })
          .finally(() => (this._isLoading = false))
      } else {
        throw new Error(error)
      }
    },

    async likeComment(entryId, id) {
      const userStore = useUserStore()
      await userStore.fetchUserIp()

      const user = userStore.getUserRef || userStore.getUserIpHash

      this._isLoading = true
      await updateDoc(doc(db, 'entries', entryId, 'comments', id), { likes: arrayUnion(user) })
        .then(() => {
          const index = this._comments.findIndex((comment) => comment.id === id)
          console.log(index)
          console.log(this._comments)
          // TODO: Fix state of comments after liking it
          this.$patch({
            _comments: [
              ...this._comments.slice(0, index),
              { ...this._comments[index], likes: [...this._comments[index].likes, user] },
              ...this._comments.slice(index + 1)
            ]
          })
        })
        .catch((error) => {
          console.error(error)
          throw new Error(error)
        })
        .finally(() => (this._isLoading = false))
    },

    async deleteComment(entryId, id, userId) {
      const userStore = useUserStore()
      await userStore.fetchUserIp()

      const comment = this.getComments.find((comment) => comment.id === id)
      const index = this._comments.findIndex((comment) => comment.id === id)

      this._isLoading = true
      if (index !== -1 && userId === (comment.author?.uid || comment.author)) {
        await deleteDoc(doc(db, 'entries', entryId, 'comments', id))
          .then(() => {
            this._comments.splice(index, 1)
          })
          .catch((error) => {
            console.error(error)
            throw new Error(error)
          })
          .finally(() => (this._isLoading = false))
      } else {
        throw new Error(error)
      }
    },

    async addReply(entryId, commentId, reply) {
      const userStore = useUserStore()
      await userStore.fetchUserIp()

      reply.author = userStore.getUserRef || userStore.getUserIpHash
      reply.created = Timestamp.fromDate(new Date())
      reply.isAnonymous = !userStore.isAuthenticated

      const stateAuthor = Object.keys(userStore.getUser).length ? userStore.getUser : userStore.getUserIpHash
      const docId = Date.now() + '-' + (reply.author.id || reply.author)

      this._isLoading = true
      await setDoc(doc(db, 'entries', entryId, 'comments', docId), reply)
        .then(() => this.$patch({ _childcomments: [...this._childcomments, { ...reply, author: stateAuthor }] }))
        .catch((err) => {
          console.log(err)
          throw new Error(err)
        })
        .finally(() => (this._isLoading = false))
    }
  }
})
