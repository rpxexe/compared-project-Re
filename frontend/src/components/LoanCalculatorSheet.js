import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import BottomSheet from "./BottomSheet";
import { formatInr } from "../utils/format";
import { eligibleLoan, FOIR, loanSummary } from "../utils/loan";
import { brand, radius, surfaces } from "../theme";
import Text, { AppTextInput as TextInput } from "./AppText";

const num = (s) => Number(String(s).replace(/[^\d.]/g, "")) || 0;
const rupees = (n) => (n > 0 ? `₹${Math.round(n).toLocaleString("en-IN")}` : "—");

function Field({ label, value, onChangeText, suffix, hint }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          value={value}
          onChangeText={(t) => onChangeText(t.replace(/[^\d.]/g, ""))}
          keyboardType="decimal-pad"
          style={styles.input}
          accessibilityLabel={label}
          maxLength={12}
        />
        {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

// EMI and loan-eligibility estimates. Pure maths on the user's own inputs: no lender data and
// no rate offers are implied, and the copy says so.
export default function LoanCalculatorSheet({ visible, onClose, initialTab = "emi" }) {
  const [tab, setTab] = useState(initialTab);
  const [amount, setAmount] = useState("5000000");
  const [rate, setRate] = useState("8.5");
  const [years, setYears] = useState("20");
  const [income, setIncome] = useState("100000");
  const [existing, setExisting] = useState("0");

  React.useEffect(() => {
    if (visible) setTab(initialTab);
  }, [visible, initialTab]);

  const emiResult = useMemo(() => loanSummary(num(amount), num(rate), num(years)), [amount, rate, years]);
  const elig = useMemo(() => eligibleLoan(num(income), num(existing), num(rate), num(years)), [income, existing, rate, years]);

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Home Loan Calculator">
      <View style={styles.tabs} accessibilityRole="tablist">
        {[
          ["emi", "EMI"],
          ["eligibility", "Eligibility"],
        ].map(([key, label]) => (
          <Pressable
            key={key}
            onPress={() => setTab(key)}
            style={[styles.tab, tab === key && styles.tabOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === key }}
          >
            <Text style={[styles.tabText, tab === key && styles.tabTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === "emi" ? (
        <>
          <Field label="Loan amount" value={amount} onChangeText={setAmount} suffix="₹" hint={formatInr(num(amount))} />
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Field label="Interest rate" value={rate} onChangeText={setRate} suffix="% p.a." />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Tenure" value={years} onChangeText={setYears} suffix="years" />
            </View>
          </View>
          <View style={styles.result} accessibilityLiveRegion="polite">
            <Text style={styles.resultLabel}>Monthly EMI</Text>
            <Text style={styles.resultValue}>{rupees(emiResult.emi)}</Text>
            <View style={styles.split}>
              <Text style={styles.splitText}>Total interest {rupees(emiResult.totalInterest)}</Text>
              <Text style={styles.splitText}>Total payable {rupees(emiResult.totalPayable)}</Text>
            </View>
          </View>
        </>
      ) : (
        <>
          <Field label="Net monthly income" value={income} onChangeText={setIncome} suffix="₹" />
          <Field label="Existing EMIs per month" value={existing} onChangeText={setExisting} suffix="₹" />
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Field label="Interest rate" value={rate} onChangeText={setRate} suffix="% p.a." />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Tenure" value={years} onChangeText={setYears} suffix="years" />
            </View>
          </View>
          <View style={styles.result} accessibilityLiveRegion="polite">
            <Text style={styles.resultLabel}>You may be eligible for about</Text>
            <Text style={styles.resultValue}>{elig.maxLoan > 0 ? formatInr(elig.maxLoan) : "—"}</Text>
            <Text style={styles.splitText}>
              {elig.maxEmi > 0 ? `At an EMI of up to ${rupees(elig.maxEmi)} per month` : "Your current EMIs leave no room for a new loan."}
            </Text>
          </View>
        </>
      )}

      <Text style={styles.disclaimer}>
        Estimates only{tab === "eligibility" ? `, assuming total EMIs stay within ${FOIR * 100}% of income` : ""}. Rates and
        eligibility vary by lender; confirm with your bank.
      </Text>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", backgroundColor: brand.lavender, borderRadius: radius.pill, padding: 4, marginBottom: 16 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: radius.pill },
  tabOn: { backgroundColor: "#FFFFFF" },
  tabText: { fontSize: 14, fontWeight: "700", color: brand.inkSoft },
  tabTextOn: { color: brand.violet },
  row: { flexDirection: "row", gap: 12 },
  field: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: "700", color: brand.ink, marginBottom: 6 },
  inputRow: { flexDirection: "row", alignItems: "center", borderRadius: radius.md, paddingHorizontal: 14, minHeight: 50, ...surfaces.field },
  input: { flex: 1, fontSize: 16, fontWeight: "700", color: brand.ink, minHeight: 48 },
  suffix: { fontSize: 13, color: brand.inkSoft, fontWeight: "600", marginLeft: 6 },
  hint: { fontSize: 12, color: brand.inkSoft, marginTop: 4 },
  result: { backgroundColor: brand.lavender, borderRadius: radius.lg, padding: 16, marginTop: 4 },
  resultLabel: { fontSize: 13, color: brand.inkSoft, fontWeight: "600" },
  resultValue: { fontSize: 28, fontWeight: "800", color: brand.deep, marginVertical: 4 },
  split: { gap: 2 },
  splitText: { fontSize: 12.5, color: brand.ink, fontWeight: "500" },
  disclaimer: { fontSize: 11.5, color: brand.inkSoft, marginTop: 12, lineHeight: 16 },
});
