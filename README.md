# Welcome to iota.keccak.pow.node.js!

**This lib is not made nor audited by the IOTA Foundation - It is community code and comes without any warranty!**

This node.js application starts a proof of work node using the iota.keccak.js lib.

## Quickstart: 

### Install:
<pre><code>git clone https://github.com/SteppoFF/iota.keccak.pow.node.js
cd iota.keccak.pow.node.js
npm install</code></pre>

Please be aware that you will need to place a libccurl file in the main directory of this app in order to get it working.

I recommend to use [dcurl](https://github.com/DLTcollab/dcurl/)

If you are still inside the iota.keccak.pow.node.js folder:

<pre><code>git clone https://github.com/DLTcollab/dcurl/ 
cd dcurl
make BUILD_GPU=0 BUILD_JNI=0 BUILD_AVX=1 BUILD_COMPAT=1 check
(Linux) cp ./build/libdcurl.so ../libccurl.so
(Mac) cp ./build/libdcurl.so ../libccurl.dylib</code></pre>

### Usage:
Just start the app and a PoW node will be spawned using port 19000 - modify the main.js to change the port.

Use a service or screen to get it running as a background application.

<pre><code>node main</code></pre>

## Greetings...
.. to gagathos and his [iota-gpu-pow](https://github.com/gagathos/iota-gpu-pow) implementation which was the foundation of this tool!

## Donations
This tool is **completely free**..
If you wish to donate anyhow, feel free to send IOTA to:

`RLCQEQFULIMGBVQSYEK9PFIATNYX9VHFNITUWFQTYIJ9DNJIDHGFKVDSCLLI9TZQPIXLCNUOAPPJGKHADUANRRZZLA`

![Donation Address](https://chart.googleapis.com/chart?chs=250x250&cht=qr&chl=RLCQEQFULIMGBVQSYEK9PFIATNYX9VHFNITUWFQTYIJ9DNJIDHGFKVDSCLLI9TZQPIXLCNUOAPPJGKHADUANRRZZLA)
