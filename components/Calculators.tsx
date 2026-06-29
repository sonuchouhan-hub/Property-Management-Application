import React, { useState } from 'react';
import { getLoanAffordabilityAdvice } from '../services/geminiService';
import Icon from './common/Icon';

const CalculatorCard: React.FC<{ title: string, children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-white p-6 rounded-b-lg shadow-lg w-full">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">{title}</h2>
        {children}
    </div>
);

const InputField: React.FC<{ label: string, value: string, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, type?: string, placeholder?: string }> = 
({ label, value, onChange, type = 'number', placeholder }) => (
    <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <input 
            type={type}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
    </div>
);

const EMICalculator = () => {
    const [principal, setPrincipal] = useState('1000000');
    const [rate, setRate] = useState('8.5');
    const [tenure, setTenure] = useState('20');
    const [emi, setEmi] = useState<number | null>(null);
    const [monthlyIncome, setMonthlyIncome] = useState('');
    const [advice, setAdvice] = useState('');
    const [isGettingAdvice, setIsGettingAdvice] = useState(false);

    const calculateEMI = () => {
        const p = parseFloat(principal);
        const r = parseFloat(rate) / 12 / 100;
        const n = parseFloat(tenure) * 12;

        if (p > 0 && r > 0 && n > 0) {
            const emiValue = (p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
            setEmi(emiValue);
        } else {
            setEmi(null);
        }
        // Reset advice when recalculating
        setAdvice('');
        setMonthlyIncome('');
    };

    const handleGetAdvice = async () => {
        if (!emi || !monthlyIncome) return;
        setIsGettingAdvice(true);
        setAdvice('');
        const result = await getLoanAffordabilityAdvice(principal, emi, monthlyIncome);
        setAdvice(result);
        setIsGettingAdvice(false);
    };
    
    return (
        <CalculatorCard title="EMI Calculator">
            <div className="space-y-4">
                <InputField label="Loan Amount (₹)" value={principal} onChange={e => setPrincipal(e.target.value)} placeholder="e.g., 1000000" />
                <InputField label="Interest Rate (%)" value={rate} onChange={e => setRate(e.target.value)} placeholder="e.g., 8.5" />
                <InputField label="Loan Tenure (Years)" value={tenure} onChange={e => setTenure(e.target.value)} placeholder="e.g., 20" />
                <button onClick={calculateEMI} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition-colors">
                    Calculate EMI
                </button>
                {emi !== null && (
                    <>
                        <div className="text-center bg-blue-50 p-4 rounded-lg mt-4">
                            <p className="text-gray-600">Your Monthly EMI</p>
                            <p className="text-3xl font-extrabold text-blue-800">₹ {Math.round(emi).toLocaleString('en-IN')}</p>
                        </div>
                        
                        <div className="mt-6 space-y-4 border-t pt-6">
                            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                <Icon name="gemini" className="w-5 h-5 text-blue-600" /> AI Affordability Analysis
                            </h3>
                            <InputField label="Your Monthly Income (₹)" value={monthlyIncome} onChange={e => setMonthlyIncome(e.target.value)} placeholder="e.g., 80000" />
                            <button onClick={handleGetAdvice} disabled={!monthlyIncome || isGettingAdvice} className="w-full bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400">
                                {isGettingAdvice ? 'Analyzing...' : 'Get AI Advice'}
                            </button>
                            {isGettingAdvice && <p className="text-center text-gray-500 animate-pulse">Getting advice...</p>}
                            {advice && (
                                <div className="bg-green-50 p-4 rounded-lg mt-4 border-l-4 border-green-400">
                                    <p className="text-green-900" style={{ whiteSpace: 'pre-wrap' }}>{advice}</p>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </CalculatorCard>
    );
};

const MortgageCalculator = () => {
    const [price, setPrice] = useState('5000000');
    const [downPayment, setDownPayment] = useState('1000000');
    const [rate, setRate] = useState('8.5');
    const [tenure, setTenure] = useState('20');
    const [result, setResult] = useState<{ emi: number; loanAmount: number; totalInterest: number; totalPayment: number } | null>(null);

    const calculateMortgage = () => {
        const p = parseFloat(price) - parseFloat(downPayment);
        const r = parseFloat(rate) / 12 / 100;
        const n = parseFloat(tenure) * 12;

        if (p > 0 && r > 0 && n > 0) {
            const emiValue = (p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
            const totalPayment = emiValue * n;
            const totalInterest = totalPayment - p;
            setResult({
                emi: emiValue,
                loanAmount: p,
                totalInterest,
                totalPayment,
            });
        } else {
            setResult(null);
        }
    };

    return (
        <CalculatorCard title="Mortgage Calculator">
            <div className="space-y-4">
                <InputField label="Property Price (₹)" value={price} onChange={e => setPrice(e.target.value)} />
                <InputField label="Down Payment (₹)" value={downPayment} onChange={e => setDownPayment(e.target.value)} />
                <InputField label="Interest Rate (%)" value={rate} onChange={e => setRate(e.target.value)} />
                <InputField label="Loan Tenure (Years)" value={tenure} onChange={e => setTenure(e.target.value)} />
                <button onClick={calculateMortgage} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition-colors">
                    Calculate Mortgage Details
                </button>
                {result && (
                    <div className="mt-4 space-y-3 bg-blue-50 p-4 rounded-lg">
                        <div className="flex justify-between items-center text-lg">
                            <span className="font-semibold text-gray-600">Loan Amount:</span>
                            <span className="font-bold text-gray-800">₹ {result.loanAmount.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex justify-between items-center text-lg">
                            <span className="font-semibold text-gray-600">Monthly EMI:</span>
                            <span className="font-extrabold text-2xl text-blue-800">₹ {Math.round(result.emi).toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex justify-between items-center text-lg">
                            <span className="font-semibold text-gray-600">Total Interest:</span>
                            <span className="font-bold text-red-600">₹ {Math.round(result.totalInterest).toLocaleString('en-IN')}</span>
                        </div>
                         <div className="flex justify-between items-center text-lg">
                            <span className="font-semibold text-gray-600">Total Payment:</span>
                            <span className="font-bold text-gray-800">₹ {Math.round(result.totalPayment).toLocaleString('en-IN')}</span>
                        </div>
                    </div>
                )}
            </div>
        </CalculatorCard>
    );
};

const InvestmentCalculator = () => {
    const [initial, setInitial] = useState('100000');
    const [monthly, setMonthly] = useState('5000');
    const [rate, setRate] = useState('12');
    const [period, setPeriod] = useState('10');
    const [result, setResult] = useState<{ futureValue: number; totalInvested: number; estimatedReturns: number } | null>(null);

    const calculateInvestment = () => {
        const p = parseFloat(initial);
        const m = parseFloat(monthly);
        const r = parseFloat(rate) / 12 / 100;
        const n = parseFloat(period) * 12;

        if (p >= 0 && m >= 0 && r > 0 && n > 0) {
            const futureValueOfP = p * Math.pow(1 + r, n);
            const futureValueOfM = m * ((Math.pow(1 + r, n) - 1) / r);
            const totalFutureValue = futureValueOfP + futureValueOfM;
            const totalInvested = p + (m * n);
            const estimatedReturns = totalFutureValue - totalInvested;
            
            setResult({
                futureValue: totalFutureValue,
                totalInvested: totalInvested,
                estimatedReturns: estimatedReturns,
            });
        } else {
            setResult(null);
        }
    };

    return (
        <CalculatorCard title="Investment Growth Calculator">
            <div className="space-y-4">
                <InputField label="Initial Investment (₹)" value={initial} onChange={e => setInitial(e.target.value)} />
                <InputField label="Monthly Contribution (₹)" value={monthly} onChange={e => setMonthly(e.target.value)} />
                <InputField label="Expected Annual Return (%)" value={rate} onChange={e => setRate(e.target.value)} />
                <InputField label="Investment Period (Years)" value={period} onChange={e => setPeriod(e.target.value)} />
                <button onClick={calculateInvestment} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition-colors">
                    Calculate Future Value
                </button>
                {result && (
                     <div className="mt-4 space-y-3 bg-green-50 p-4 rounded-lg">
                        <div className="flex justify-between items-center text-lg">
                            <span className="font-semibold text-gray-600">Total Invested:</span>
                            <span className="font-bold text-gray-800">₹ {Math.round(result.totalInvested).toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex justify-between items-center text-lg">
                            <span className="font-semibold text-gray-600">Estimated Returns:</span>
                            <span className="font-bold text-green-700">₹ {Math.round(result.estimatedReturns).toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex justify-between items-center text-lg">
                            <span className="font-semibold text-gray-600">Future Value:</span>
                            <span className="font-extrabold text-2xl text-green-800">₹ {Math.round(result.futureValue).toLocaleString('en-IN')}</span>
                        </div>
                    </div>
                )}
            </div>
        </CalculatorCard>
    );
};


const Calculators: React.FC = () => {
  const [activeTab, setActiveTab] = useState('emi');

    const renderCalculator = () => {
        switch (activeTab) {
            case 'mortgage':
                return <MortgageCalculator />;
            case 'investment':
                return <InvestmentCalculator />;
            case 'emi':
            default:
                return <EMICalculator />;
        }
    };

    const TabButton = ({ id, label }: { id: string, label: string }) => {
        const isActive = activeTab === id;
        return (
            <button
                onClick={() => setActiveTab(id)}
                className={`flex-1 py-3 px-2 text-center font-semibold border-b-4 transition-colors ${
                    isActive
                        ? 'text-blue-600 border-blue-600'
                        : 'text-gray-500 border-transparent hover:text-gray-800 hover:border-gray-300'
                }`}
            >
                {label}
            </button>
        );
    };

    return (
        <div>
            <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">Financial Tools</h1>
            <div className="max-w-md mx-auto">
                <div className="bg-gray-100 rounded-t-lg flex mb-[-1px]">
                    <TabButton id="emi" label="EMI" />
                    <TabButton id="mortgage" label="Mortgage" />
                    <TabButton id="investment" label="Investment" />
                </div>
                {renderCalculator()}
            </div>
        </div>
    );
};

export default Calculators;