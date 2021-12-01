import { getProgressBar } from "./progress.js"

// const progressBar = getProgressBar({ current: 0, total: 690 })
// const progressBar2 = getProgressBar({ current: 0, total: 1240 })
// progressBar.watch()
// progressBar2.watch()
// const timer = setInterval(() => {
//     if (progressBar.getProgress().current === progressBar.getProgress().total && progressBar2.getProgress().current === progressBar2.getProgress().total) return clearInterval(timer)
//     progressBar.getProgress().current += 60
//     progressBar2.getProgress().current += 30
// }, 100)


`
Searching 690                
[================100%=================]
Downloaded 540               Total: 720
[=================77%=========>       ]
`

`
Searching :seaech_c st media   Total: :search
[===================100%====================]
Downloading :down_c st media     Total: :down
[====================77%===========>        ]
`

`
Searching :seaech_c st media:padTotal: :search
[:_bar_1]
Downloading :down_c st media:padTotal: :down
[:_bar_2]
`
ProgressBar.setTemplate()
ProgressBar.set(':total', val)
ProgressBar.set(':total', val)