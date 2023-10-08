/**
 * Blog HN
 *
 * MIT License
 *
 * (c) 2023 simonpure
 **/
'use strict';
this.app = this.app || {};
(async (app) => {
  console.debug('loading...')
  try {
    const BASE = 'https://hacker-news.firebaseio.com';
    const VERSION = `v0`
    const BATCH_SIZE = 100

    const DEFAULT_PARAMS = { user: 'simonpure', filter: 'Blog HN' }

    const cache = app.cache || {}
    const state = app.state || {}
  
    const slurp = async (url) =>
      cache[url]
        ?
          Promise.resolve(cache[url])
        :
          fetch(url).then(e => e.json())
            .then(e => {
              cache[url] = e
              return e
            })

    // credit
    // https://javascript.plainenglish.io/a-powerful-trick-to-batch-promises-using-async-generators-in-javascript-6032f872676f
    const batch = async function* (urls, size, cb = (e) => e) {
      for (let i = 0; i < urls.length; i = i + size) {
        const chunk = urls.slice(i, i + size)
        const result = Promise.all(chunk.map(url => slurp(url).then(e => cb(e))))
        yield result
      }
    }

    const process = async (urls, cb = (e) => e) => {
      console.debug('processing ', urls.length)
      let result = []
      for await (const chunk of batch(urls, BATCH_SIZE)) {
        cb(chunk)
        result = result.concat(chunk)
      }
      return result
    }

    const url = (entity, id) => {
      const opt = entity ? `${entity}/` : '' 
      return `${BASE}/${VERSION}/` + `${opt}` + `${id}.json`
    }

    const item = url.bind(null, 'item') 
    const user = url.bind(null, 'user') 

    const maxitem = url.bind(null, null, 'maxitem') 
    const topstories = url.bind(null, null, 'topstories') 
    const updates = url.bind(null, null, 'updates') 

    const render = async (container, components, state) => {
      container.innerHTML = `
        <div>
          ${components.user(state.user)}
          <ul>
            ${state.stories.map(story => '<li>' + components.story(story) + '</li>').join('')}
          </ul>
        </div>`
    }

    const updateState = async (state, text) => {
      state.stories = []

      const filter = (xs) => text.length ?
        xs.filter(({ title }) => title)
          .filter(({ title }) => title.startsWith(text))
        :
        xs.filter(({ title }) => title)

      const updateComments = async (items) => {
        if (!items || !items.length) return
        process(
          items.filter(({ kids }) => kids).map(({ kids }) => kids.map(e => item(e))).flat()
        ).then(comments => {
          comments.forEach(comment => state[comment.id] = comment)
          setTimeout(async () => await render(document.querySelector('#container'), components, state), 0)
          updateComments(comments.filter(({ kids }) => kids))
        })
      }

      await process(
          state.user.submitted.map(e => item(e)),
          (chunk) => {
            const stories = filter(chunk)
            state.stories = state.stories.concat(stories)
            setTimeout(async () => await render(document.querySelector('#container'), components, state), 0)
            //setTimeout(async () => await updateComments(stories), 0)
          }
        ).then(result => filter(result))
         .then(stories => state.stories = stories)

      await updateComments(state.stories)
    }

    const levels = (id, i = 0) => state[id] && state[id].parent ? levels(state[id].parent, ++i) : i

    const components = {
      url: (url, title) => `<a href="${url}" target="_blank">${title}</a>`,
      user: ({ about, created, id, karma, submitted }) => `
        <div>
          <b>${id}</b>
          <small>${karma}</small>
          <p>${about}</p>
        </div>`,
      comment: ({ by, id, kids, parent, text, time, type, deleted }) => `
        <li>
          <div>
            ${text}
          </div>
          <small>${by}</small>
        </li>`,
      comments: (ids) => `
        <ul>
          ${ids ?
              ids.map(id => state[id])
                .filter(comment => comment && comment.id)
                .map((comment) => components.comment(comment) + components.comments(comment.kids))
                .join('<hr>')
              : ''}
        </ul>`,
      story: ({ by, id, descendants, score, time, title, type, url, kids }) => `
        <div>
          <h2>
            <small>${components.url('https://news.ycombinator.com/item?id=' + id, score)}</small>
            ${components.url(url ? url : 'https://news.ycombinator.com/item?id=' + id, title)}
            <small>${cache[time] = cache[time] || new Date(time * 1000).toLocaleString().split(',')[0]}</small>
          </h2>
          <hr>
          ${kids ? components.comments(kids) + '<hr>' : ''}
        </div>`
    }


    const search = window.location.search.replace('?', '')
    const params = search.length ?
      Object.assign(DEFAULT_PARAMS,
        Object.fromEntries(search.split('&').map(e => e.split('=')).map(([k, v]) => [k, decodeURIComponent(v)])))
        : DEFAULT_PARAMS

    state.user = await slurp(user(params.user))

    document.title = `Hacker News (${params.user})`

    await updateState(state, params.filter)
    await render(document.querySelector('#container'), components, state)

    Object.assign(app, {
      cache, state,
      slurp, process,
      url, item, user, maxitem, topstories, updates,
      updateState,
      components, render,
      params
    })

    console.debug('done')

  } catch(e) {
    console.debug(`error: ${e.message}`)
  }
}).call(this, this.app)

this.reload = () => {
  const el = document.createElement('script')
  el.src = `app.js?${Date.now()}`
  el.addEventListener('load', (_) => console.debug('reloaded'))
  document.head.appendChild(el)
}
