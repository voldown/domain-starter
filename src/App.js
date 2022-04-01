import React, { useEffect, useState } from 'react';
import './styles/App.css';
import twitterLogo from './assets/twitter-logo.svg';
import { ethers } from "ethers";
import contractAbi from './utils/contractABI.json';
import polygonLogo from './assets/polygonlogo.png';
import ethLogo from './assets/ethlogo.png';
import { networks } from './utils/networks';

// constants
const TWITTER_HANDLE = '_buildspace';
const TWITTER_LINK = `https://twitter.com/${TWITTER_HANDLE}`;
// domain
const tld = '.lfg';
const CONTRACT_ADDRESS = '0x50379B844052817d70793F38f9b362A2e5Bc69ff';

const App = () => {
	// a stateful variable to store the network
	const [network, setNetwork] = useState('');
	// a state variable to store our user's public wallet
	const [currentAccount, setCurrentAccount] = useState('');
	// add some state data properties
	const [domain, setDomain] = useState(''); // the initial state is an empty string
  const [record, setRecord] = useState('');

  const [editing, setEditing] = useState(false); // the initial state is false
  const [loading, setLoading] = useState(false);

  const [mints, setMints] = useState([]); // the initial state is an empty array

	// implement your connectWallet method here
  const connectWallet = async () => {
    try {
      const { ethereum } = window;

      if (!ethereum) {
        alert("go get MetaMask -> https://metamask.io/");
        return;
      }

      // fancy method to request access to account
      const accounts = await ethereum.request({ method: "eth_requestAccounts" });
    
      // Boom! This should print out public address once we authorize Metamask.
      console.log("connected", accounts[0]);
      setCurrentAccount(accounts[0]);
    } catch (error) {
      console.log(error)
    }
  }

  // switch network function using MetaMask API
  const switchNetwork = async () => {
	  if (window.ethereum) {
	    try {
	      // try to switch to the Mumbai testnet
	      await window.ethereum.request({
	        method: 'wallet_switchEthereumChain',
	        params: [{ chainId: '0x13881' }], // Check networks.js for hexadecimal network ids
	      });
	    } catch (error) {
	      // this error code means that the chain we want has not been added to MetaMask
	      // in this case we ask the user to add it to their MetaMask
	      if (error.code === 4902) {
	        try {
	          await window.ethereum.request({
	            method: 'wallet_addEthereumChain',
	            params: [
	              {	
	                chainId: '0x13881',
	                chainName: 'Polygon Mumbai Testnet',
	                rpcUrls: ['https://rpc-mumbai.maticvigil.com/'],
	                nativeCurrency: {
	                    name: "Mumbai Matic",
	                    symbol: "MATIC",
	                    decimals: 18
	                },
	                blockExplorerUrls: ["https://mumbai.polygonscan.com/"]
	              },
	            ],
	          });
	        } catch (error) {
	          console.log(error);
	        }
	      }
	      console.log(error);
	    }
	  } else {
	    // if window.ethereum is not found then MetaMask is not installed
	    alert('MetaMask is not installed. please install it to use this app: https://metamask.io/download.html');
	  } 
	}

	// make sure this is async
	const checkIfWalletIsConnected = async () => {
		// make sure we have access to window.ethereum
		const { ethereum } = window;

		if (!ethereum) {
			console.log("make sure you have MetaMask!");
			return;
		} else {
			console.log("we have the ethereum object", ethereum);
		}

		// check if we're authorized to access the user's wallet
		const accounts = await ethereum.request({ method: 'eth_accounts' });

    // users can have multiple authorized accounts, we grab the first one if its there!
    if (accounts.length !== 0) {
      const account = accounts[0];
      console.log('found an authorized account:', account);
      setCurrentAccount(account);
    } else {
      console.log('no authorized account found');
    }

    // check the user's network chain ID
    const chainId = await ethereum.request({ method: 'eth_chainId' });

    setNetwork(networks[chainId]);

    ethereum.on('chainChanged', handleChainChanged);
    ethereum.on('accountsChanged', handleAccountsChanged);

    // reload the page when network is changed
    function handleChainChanged(_chainId) {
    	window.location.reload();
    }

    // reload the page when account is changed
    function handleAccountsChanged(_accounts) {
    	window.location.reload();
    }
	}

	const mintDomain = async () => {
		// don't run if the domain is empty
		if (!domain) { return }
		// alert the user if the domain is too short
		if (domain.length < 3) {
			alert('domain must be at least 3 characters long');
			return;
		}
		// calculate price based on length of domain (change this to match your contract)	
		// 3 chars = 0.5 MATIC, 4 chars = 0.3 MATIC, 5 or more = 0.1 MATIC
		const price = domain.length === 3 ? '0.5' : domain.length === 4 ? '0.3' : '0.1';
		console.log("minting domain", domain, "with price", price);
		console.log(`minting domain ${domain} with price ${price}`);

	  try {
	    const { ethereum } = window;
	    if (ethereum) {
	      const provider = new ethers.providers.Web3Provider(ethereum);
	      const signer = provider.getSigner();
	      const contract = new ethers.Contract(CONTRACT_ADDRESS, contractAbi.abi, signer);

				console.log("going to pop wallet now to pay gas...")
	      let tx = await contract.register(domain, {value: ethers.utils.parseEther(price)});
	      // wait for the transaction to be mined
				const receipt = await tx.wait();

				// check if the transaction was successfully completed
				if (receipt.status === 1) {
					console.log("domain minted! https://mumbai.polygonscan.com/tx/"+tx.hash);
					window.alert("domain minted! https://mumbai.polygonscan.com/tx/"+tx.hash);

					// set the record for the domain
					tx = await contract.setRecord(domain, record);
					await tx.wait();

					console.log("record set! https://mumbai.polygonscan.com/tx/"+tx.hash);
					
					// call fetchMints after 2 seconds
					setTimeout(() => {
						fetchMints();
					}, 2000);

					setRecord('');
					setDomain('');
				}
				else {
					alert("transaction failed! please try again later");
				}
	    }
  	}
	  catch(error) {
	    console.log(error);
	  }
	}

	const fetchMints = async () => {
	  try {
	    const { ethereum } = window;
	    if (ethereum) {
	      const provider = new ethers.providers.Web3Provider(ethereum);
	      const signer = provider.getSigner();
	      const contract = new ethers.Contract(CONTRACT_ADDRESS, contractAbi.abi, signer);

	      // get all the domain names from our contract
	      const names = await contract.getAllNames();
	        
	      // get the record and the address for each name
	      const mintRecords = await Promise.all(names.map(async (name) => {
		      const mintRecord = await contract.records(name);
		      const owner = await contract.domains(name);
		      return {
		        id: names.indexOf(name),
		        name: name,
		        record: mintRecord,
		        owner: owner,
		      };
	    	}));

	    	console.log("mints fetched:", mintRecords);
	    	setMints(mintRecords);
	    }
	  } catch(error) {
	    console.log(error);
	  }
	}

	const updateDomain = async () => {
		if (!record || !domain) { return }
	  setLoading(true);
	  console.log("updating domain", domain, "with record", record);
	    try {
	    const { ethereum } = window;
	    if (ethereum) {
	      const provider = new ethers.providers.Web3Provider(ethereum);
	      const signer = provider.getSigner();
	      const contract = new ethers.Contract(CONTRACT_ADDRESS, contractAbi.abi, signer);

	      let tx = await contract.setRecord(domain, record);
	      await tx.wait();
	      console.log("record set https://mumbai.polygonscan.com/tx/"+tx.hash);

	      fetchMints();
	      setRecord('');
	      setDomain('');
	    }
	    } catch(error) {
	      console.log(error);
	    }
	  setLoading(false);
	}

	// create a function to render if wallet is not connected yet
	const renderNotConnectedContainer = () => (
		<div className="connect-wallet-container">
			<button onClick={connectWallet} className="cta-button connect-wallet-button">
				connect wallet
			</button>
		</div>
  	);

	// form to enter domain name and data
	const renderInputForm = () =>{
		// if the user is not on Polygon Mumbai Testnet, render the switch network button
		if (network !== 'Polygon Mumbai Testnet') {
			return (
				<div className="connect-wallet-container">
					<p>please connect to the polygon mumbai testnet</p>
				{/* this button will call the switch network function*/}
				<button className='cta-button mint-button' onClick={switchNetwork}>switch network</button>
				</div>
			);
		}

		return (
			<div className="form-container">
				<div className="first-row">
					<input
						type="text"
						value={domain}
						placeholder='domain'
						onChange={e => setDomain(e.target.value)}
					/>
					<p className='tld'> {tld} </p>
				</div>

				<input
					type="text"
					value={record}
					placeholder="let's freakin' go!" 
					onChange={e => setRecord(e.target.value)}
				/>

{/*				<div className="button-container">
					<button className='cta-button mint-button' onClick={mintDomain}>
						mint
					</button>  
					<button className='cta-button mint-button' disabled={null} onClick={null}>
						set data
					</button>  
				</div>*/}

				{/* If the editing variable is true, return the "Set record" and "Cancel" button */}
          {editing ? (
            <div className="button-container">
              {/* this will call the updateDomain function we just made */}
              <button className='cta-button mint-button' disabled={loading} onClick={updateDomain}>
                set record
              </button>  
              {/* this will let us get out of editing mode by setting editing to false */}
              <button className='cta-button mint-button' onClick={() => {setEditing(false)}}>
                cancel
              </button>  
            </div>
          ) : (
            // If editing is not true, the mint button will be returned instead
            <button className='cta-button mint-button' disabled={loading} onClick={mintDomain}>
              mint
            </button>  
          )}

			</div>
		);
	}

	const renderMints = () => {
	  if (currentAccount && mints.length > 0) {
	    return (
	      <div className="mint-container">
	        <p className="subtitle"> recently minted domains!</p>
	        <div className="mint-list">
	          { mints.map((mint, index) => {
	            return (
	              <div className="mint-item" key={index}>
	                <div className='mint-row'>
	                  <a className="link" href={`https://testnets.opensea.io/assets/mumbai/${CONTRACT_ADDRESS}/${mint.id}`} target="_blank" rel="noopener noreferrer">
	                    <p className="underlined">{' '}{mint.name}{tld}{' '}</p>
	                  </a>
	                  {/* if mint.owner is currentAccount, add an "edit" button*/}
	                  { mint.owner.toLowerCase() === currentAccount.toLowerCase() ?
	                    <button className="edit-button" onClick={() => editRecord(mint.name)}>
	                      <img className="edit-icon" src="https://img.icons8.com/metro/26/000000/pencil.png" alt="Edit button" />
	                    </button>
	                    :
	                    null
	                  }
	                </div>
	          <p> {mint.record} </p>
	        </div>)
	        })}
	      </div>
	    </div>);
	  }
	};

	const editRecord = (name) => {
	  console.log("editing record for", name);
	  setEditing(true);
	  setDomain(name);
	}

	// this runs our function when the page loads
	useEffect(() => {
		checkIfWalletIsConnected();
	}, [])

	// this will run any time currentAccount or network are changed
	useEffect(() => {
	  if (network === 'Polygon Mumbai Testnet') {
	    fetchMints();
	  }
	}, [currentAccount, network]);

  return (
		<div className="App">
			<div className="container">

				<div className="header-container">
					<header>
            <div className="left">
              <p className="title">lfg name service</p>
              <p className="subtitle">let's freakin' go!</p>
            </div>
				    {/* Display a logo and wallet connection status*/}
				    <div className="right wallet-address-container">
				      <img alt="Network logo" className="logo" src={ network.includes("Polygon") ? polygonLogo : ethLogo} />
				      { currentAccount ? <p> Wallet: {currentAccount.slice(0, 6)}...{currentAccount.slice(-4)} </p> : <p> not connected </p> }
				    </div>
					</header>
				</div>

        {/* hide the connect button if currentAccount isn't empty*/}
        {!currentAccount && renderNotConnectedContainer()}
        {/* 4ender the input form if an account is connected */}
				{currentAccount && renderInputForm()}
				{mints && renderMints()}

        <div className="footer-container">
					<img alt="Twitter Logo" className="twitter-logo" src={twitterLogo} />
					<a
						className="footer-text"
						href={TWITTER_LINK}
						target="_blank"
						rel="noreferrer"
					>{`built with @${TWITTER_HANDLE}`}</a>
				</div>
			</div>
		</div>
	);
}

export default App;
